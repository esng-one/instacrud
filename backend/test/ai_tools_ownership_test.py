"""Generic crud_* tools must enforce per-user ownership on user-scoped models (Conversation),
and the write-payload scanners must fail closed on over-deep nesting."""

import os
import sys
import pytest
from unittest.mock import patch
from beanie import PydanticObjectId

_backend_dir = os.path.join(os.path.dirname(__file__), "..")
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

from instacrud.context import current_user_context, CurrentUserContext
from instacrud.database import init_org_db
from instacrud.model.system_model import User, Role
from instacrud.ai.functions import crud as crud_mod
from instacrud.ai.functions.crud import (
    crud_create, crud_get, crud_list, crud_update, crud_patch, crud_delete,
    _scan_for_nosql_data_keys, _MAX_SCAN_DEPTH,
)

USER_A = PydanticObjectId("6579a0000000000000000a01")
USER_B = PydanticObjectId("6579a0000000000000000b02")


async def _noop_guardrail(*a, **k):
    return None


def _ctx(uid):
    return CurrentUserContext(user_id=uid, email=f"{uid}@t.io", role="USER", organization_id="own_org")


def _docid(doc):
    return doc.get("_id") or doc.get("id")


@pytest.mark.asyncio
async def test_generic_tools_enforce_conversation_ownership(initialized_system_db, test_mode):
    if test_mode != "mock":
        pytest.skip("Ownership test runs against the mock org DB")

    # user_id is an FK to User, so both owners must exist in the system DB
    created_users = []
    for uid, name in ((USER_A, "A"), (USER_B, "B")):
        if not await User.get(uid):
            u = User(email=f"{uid}@t.io", name=name, role=Role.USER, hashed_password=None, organization_id=None)
            u.id = uid
            await u.insert()
            created_users.append(uid)

    await init_org_db("ownership_test_org")

    with patch.object(crud_mod, "settings") as s, \
         patch.object(crud_mod, "_llm_guardrail", _noop_guardrail):
        s.ALLOW_AI_TOOLS = True
        s.ALLOW_AI_RW_ACCESS = True
        s.ALLOW_AI_SYSTEM_ACCESS = False

        # User A creates a private conversation
        tok = current_user_context.set(_ctx(USER_A))
        try:
            created = await crud_create("Conversation", {"title": "A's secret"})
            conv_id = _docid(created)
            assert str(created["user_id"]) == str(USER_A)  # owner forced to caller
        finally:
            current_user_context.reset(tok)

        # User B must not be able to reach it by any verb
        tok = current_user_context.set(_ctx(USER_B))
        try:
            with pytest.raises(ValueError, match="not found"):
                await crud_get("Conversation", conv_id)
            listed = await crud_list("Conversation")
            assert all(str(d.get("user_id")) != str(USER_A) for d in listed), "B saw A's conversation"
            with pytest.raises(ValueError, match="not found"):
                await crud_update("Conversation", conv_id, {"title": "hacked"})
            with pytest.raises(ValueError, match="not found"):
                await crud_patch("Conversation", conv_id, {"title": "hacked"})
            with pytest.raises(ValueError, match="not found"):
                await crud_delete("Conversation", conv_id)
            # B's create is owned by B, never A
            b_made = await crud_create("Conversation", {"title": "B's own", "user_id": str(USER_A)})
            assert str(b_made["user_id"]) == str(USER_B)  # supplied user_id ignored
        finally:
            current_user_context.reset(tok)

        # A still owns and can read/update its conversation; title unchanged by B
        tok = current_user_context.set(_ctx(USER_A))
        try:
            got = await crud_get("Conversation", conv_id)
            assert got["title"] == "A's secret"
            mine = await crud_list("Conversation")
            assert any(_docid(d) == conv_id for d in mine)
            await crud_delete("Conversation", conv_id)  # owner can delete
            b_id = _docid(b_made)
        finally:
            current_user_context.reset(tok)

        # cleanup B's doc
        tok = current_user_context.set(_ctx(USER_B))
        try:
            await crud_delete("Conversation", b_id)
        finally:
            current_user_context.reset(tok)

    for uid in created_users:
        u = await User.get(uid)
        if u:
            await u.delete()


def test_nosql_scanner_fails_closed_on_deep_nesting():
    # A $-operator key buried just past the depth limit must be rejected, not skipped.
    payload = cur = {}
    for _ in range(_MAX_SCAN_DEPTH + 2):
        nxt = {}
        cur["x"] = nxt
        cur = nxt
    cur["$where"] = "evil"
    with pytest.raises(ValueError, match="too deeply"):
        _scan_for_nosql_data_keys(payload)
