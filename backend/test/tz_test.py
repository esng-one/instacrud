"""
TZ fix regression tests.

Tests the two bugs fixed in commits e4f6396 and 5648b7b:

1. UtcDatetimeMixin: naive datetimes from MongoDB get UTC tzinfo re-attached.
   → Serialization produces "...+00:00" so JS parses as UTC, not local time.

2. DateValidatorMixin.validate_dates: handles mixed-tz start_date (UTC-aware,
   from existing DB record) + naive end_date (plain date from frontend picker)
   without crashing with TypeError.

Integration test covers the full roundtrip:
   POST project  → start_date returns as UTC ("...Z")
   PUT project   → re-sending that UTC start_date + plain end_date must not crash
"""
import time
import pytest
import httpx
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel

from instacrud.api.validators import DateValidatorMixin, UtcDatetimeMixin, NormalizeInputMixin


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

class _DtModel(BaseModel, UtcDatetimeMixin):
    ts: Optional[datetime] = None


class _ProjectSchema(BaseModel, NormalizeInputMixin, DateValidatorMixin):
    start_date: datetime
    end_date: Optional[datetime] = None


# ─────────────────────────────────────────────────────────────────────────────
# Unit: UtcDatetimeMixin
# ─────────────────────────────────────────────────────────────────────────────

class TestUtcDatetimeMixin:

    def test_naive_datetime_gets_utc(self):
        """Naive datetime (as Motor returns from MongoDB) becomes UTC-aware."""
        naive = datetime(2026, 3, 10, 0, 0, 0)
        m = _DtModel(ts=naive)
        assert m.ts.tzinfo is not None
        assert m.ts.utcoffset().total_seconds() == 0

    def test_aware_datetime_unchanged(self):
        """Already UTC-aware datetime passes through as-is."""
        aware = datetime(2026, 3, 10, 12, 30, 0, tzinfo=timezone.utc)
        m = _DtModel(ts=aware)
        assert m.ts.tzinfo == timezone.utc
        assert m.ts.hour == 12
        assert m.ts.minute == 30

    def test_none_passes_through(self):
        m = _DtModel(ts=None)
        assert m.ts is None

    def test_utc_midnight_preserves_calendar_date(self):
        """UTC midnight → isoformat contains the original date, not shifted by local TZ."""
        naive = datetime(2026, 3, 10, 0, 0, 0)
        m = _DtModel(ts=naive)
        iso = m.ts.isoformat()
        # e.g. "2026-03-10T00:00:00+00:00"
        assert iso.startswith("2026-03-10"), f"Calendar date shifted! Got: {iso}"
        assert "2025" not in iso, "Year should not have shifted to 2025"

    def test_utc_new_years_midnight_does_not_shift_to_dec31(self):
        """Jan 1 UTC midnight must not become Dec 31 of prior year."""
        naive = datetime(2026, 1, 1, 0, 0, 0)
        m = _DtModel(ts=naive)
        iso = m.ts.isoformat()
        assert iso.startswith("2026-01-01"), f"New Year shifted! Got: {iso}"


# ─────────────────────────────────────────────────────────────────────────────
# Unit: DateValidatorMixin
# ─────────────────────────────────────────────────────────────────────────────

class TestDateValidatorMixin:

    def test_utc_aware_start_naive_end_after_start_ok(self):
        """Bug scenario: start UTC-aware (from DB), end naive (from picker) — should not crash."""
        start = datetime(2026, 3, 10, 0, 0, 0, tzinfo=timezone.utc)
        end   = datetime(2026, 3, 14, 0, 0, 0)   # naive, as Pydantic parses "2026-03-14"
        m = _ProjectSchema(start_date=start, end_date=end)
        assert m.start_date is not None
        assert m.end_date is not None

    def test_utc_aware_start_naive_end_before_start_raises_422(self):
        """Mixed tz: end before start → 422, not TypeError."""
        from fastapi import HTTPException
        start = datetime(2026, 3, 14, 0, 0, 0, tzinfo=timezone.utc)
        end   = datetime(2026, 3, 10, 0, 0, 0)   # naive, earlier date
        with pytest.raises(HTTPException) as exc_info:
            _ProjectSchema(start_date=start, end_date=end)
        assert exc_info.value.status_code == 422

    def test_both_naive_ok(self):
        start = datetime(2026, 3, 10)
        end   = datetime(2026, 3, 20)
        m = _ProjectSchema(start_date=start, end_date=end)
        assert m.end_date > m.start_date

    def test_both_utc_aware_ok(self):
        start = datetime(2026, 3, 10, tzinfo=timezone.utc)
        end   = datetime(2026, 3, 20, tzinfo=timezone.utc)
        m = _ProjectSchema(start_date=start, end_date=end)
        assert m.end_date > m.start_date

    def test_both_naive_reversed_raises(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException):
            _ProjectSchema(start_date=datetime(2026, 3, 20),
                           end_date=datetime(2026, 3, 10))

    def test_same_day_mixed_tz_ok(self):
        """Same calendar day: UTC-aware start, naive end → OK (not end < start)."""
        start = datetime(2026, 3, 10, 0, 0, 0, tzinfo=timezone.utc)
        end   = datetime(2026, 3, 10, 0, 0, 0)   # same day, naive
        m = _ProjectSchema(start_date=start, end_date=end)
        assert m is not None

    def test_no_end_date_skips_validation(self):
        m = _ProjectSchema(start_date=datetime(2026, 3, 10, tzinfo=timezone.utc))
        assert m.end_date is None


# ─────────────────────────────────────────────────────────────────────────────
# Integration: Project date roundtrip via HTTP
# ─────────────────────────────────────────────────────────────────────────────

_TS = str(int(time.time()))


@pytest.mark.asyncio
async def test_project_date_roundtrip(http_client: httpx.AsyncClient, clean_db, test_mode):
    """
    Full roundtrip regression test:

    1. POST  project with plain "YYYY-MM-DD" start_date (what toLocalIsoDate sends).
    2. GET   project — start_date in response must have Z/UTC offset (not bare date).
    3. PUT   project re-sending the UTC start_date + a plain end_date.
             Old code: TypeError (aware vs naive) → 500.
             Fixed code: 200, dates preserved.
    """
    from passlib.context import CryptContext
    from instacrud.model.system_model import User, Organization, Role
    from instacrud.model.organization_model import Project as PModel, Client as CModel
    from instacrud.database import init_org_db
    from conftest import wait_for_org_active

    pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
    admin_email = f"tz_admin_{_TS}@test.com"
    user_email  = f"tz_user_{_TS}@test.com"
    org_code    = f"tz_org_{_TS}"

    # --- Create admin & sign in ---
    admin = User(email=admin_email,
                 hashed_password=pwd.hash("tz_admin_pass1"),
                 name="TZ Admin", role=Role.ADMIN)
    await admin.insert()

    resp = await http_client.post("/api/v1/signin",
                                  json={"email": admin_email, "password": "tz_admin_pass1"})
    assert resp.status_code == 200
    admin_h = {"Authorization": f"Bearer {resp.json()['access_token']}"}

    # --- Create org ---
    resp = await http_client.post("/api/v1/admin/organizations",
                                  json={"name": "TZ Org", "code": org_code},
                                  headers=admin_h)
    assert resp.status_code == 200

    org = await Organization.find_one(Organization.code == org_code)
    org_id = str(org.id)
    await wait_for_org_active(http_client, org_id, admin_h)

    # --- Add user ---
    resp = await http_client.post("/api/v1/admin/add_user",
                                  json={"email": user_email, "password": "tz_user_pass1",
                                        "name": "TZ User", "role": "USER",
                                        "organization_id": org_id},
                                  headers=admin_h)
    assert resp.status_code == 200

    resp = await http_client.post("/api/v1/signin",
                                  json={"email": user_email, "password": "tz_user_pass1"})
    assert resp.status_code == 200
    user_h = {"Authorization": f"Bearer {resp.json()['access_token']}"}

    # --- Create client ---
    resp = await http_client.post("/api/v1/clients",
                                  json={"code": f"tz_cl_{_TS}", "name": "TZ Client",
                                        "type": "COMPANY"},
                                  headers=user_h)
    assert resp.status_code == 200
    client_id = resp.json()["_id"]

    # --- Step 1: POST with plain date ---
    resp = await http_client.post("/api/v1/projects",
                                  json={"code": f"TZ_P_{_TS}",
                                        "client_id": client_id,
                                        "name": "TZ Test Project",
                                        "start_date": "2026-03-10"},
                                  headers=user_h)
    assert resp.status_code == 200, f"create failed: {resp.text}"
    project_id = resp.json()["_id"]

    # --- Step 2: GET by ID — start_date must be UTC-aware in response ---
    resp = await http_client.get(f"/api/v1/projects/{project_id}", headers=user_h)
    assert resp.status_code == 200
    data = resp.json()
    start_str = data["start_date"]

    assert "Z" in start_str or "+00:00" in start_str, \
        f"start_date should be UTC-aware but got: {start_str!r}"

    # Calendar date must NOT have shifted
    assert start_str.startswith("2026-03-10"), \
        f"Calendar date shifted on read! Got: {start_str!r}"

    # --- Step 3: PUT with UTC start (from DB response) + plain end_date ---
    # This is the exact crash scenario before the fix.
    resp = await http_client.put(f"/api/v1/projects/{project_id}",
                                 json={"code": f"TZ_P_{_TS}",
                                       "client_id": client_id,
                                       "name": "TZ Test Project Updated",
                                       "start_date": start_str,   # UTC-aware (from DB)
                                       "end_date": "2026-03-14"}, # plain date (from picker)
                                 headers=user_h)
    assert resp.status_code == 200, \
        f"PUT with mixed-tz dates failed (regression!): {resp.text}"

    updated = resp.json()
    assert updated["start_date"].startswith("2026-03-10"), \
        f"start_date shifted after update: {updated['start_date']!r}"
    assert updated["end_date"].startswith("2026-03-14"), \
        f"end_date shifted after update: {updated['end_date']!r}"

    # --- Step 4: Verify end_date < start_date is still rejected ---
    resp = await http_client.put(f"/api/v1/projects/{project_id}",
                                 json={"code": f"TZ_P_{_TS}",
                                       "client_id": client_id,
                                       "name": "TZ Test Project",
                                       "start_date": start_str,   # 2026-03-10
                                       "end_date": "2026-03-01"}, # before start
                                 headers=user_h)
    assert resp.status_code == 422, \
        f"Expected 422 for end < start but got {resp.status_code}: {resp.text}"

    # --- Cleanup ---
    await init_org_db(org_id)
    p = await PModel.get(project_id)
    if p:
        await p.delete()
    c = await CModel.get(client_id)
    if c:
        await c.delete()

    o = await Organization.get(org_id)
    if o:
        await o.delete()

    u = await User.find_one(User.email == user_email)
    if u:
        await u.delete()

    await admin.delete()
