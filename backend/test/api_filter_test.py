"""Filter parsing: a junk id in ?filters= returns a clean 400, not a 500."""

import os
import sys
import pytest
from fastapi import HTTPException

_backend_dir = os.path.join(os.path.dirname(__file__), "..")
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

from instacrud.api.api_utils import _parse_filter, _convert_value
from instacrud.config import settings


@pytest.mark.parametrize("field,value", [
    ("_id", "not-an-objectid"),
    ("client_id", "123"),
    ("id", "zzzz"),
])
def test_junk_object_id_raises_400(field, value):
    with pytest.raises(HTTPException) as exc:
        _convert_value(field, value)
    assert exc.value.status_code == 400

    with pytest.raises(HTTPException) as exc2:
        _parse_filter({field: value})
    assert exc2.value.status_code == 400


def test_valid_object_id_still_parses():
    out = _parse_filter({"_id": "6579a0000000000000000a01"})
    assert "_id" in out


def test_trusted_proxies_not_wildcard_by_default():
    # The rate-limit key is only trustworthy if X-Forwarded-For isn't trusted from any peer.
    assert settings.TRUSTED_PROXIES != "*"
