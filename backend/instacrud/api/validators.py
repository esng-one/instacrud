# instacrud/api/validators.py
from datetime import datetime, timezone
from fastapi import HTTPException
from loguru import logger
from pydantic import constr, field_validator, model_validator
from beanie import Document, PydanticObjectId
from pymongo.errors import DuplicateKeyError
from typing import Any, Type, List

# -----------------------------------------
# BASIC REUSABLE TYPE ALIASES
# -----------------------------------------
NonEmptyStr = constr(strip_whitespace=True, min_length=1)
ObjectIdRef = PydanticObjectId  # use NormalizeInputMixin to handle blanks


# =========================================================
#  HELPER: raise structured ValidationError for a field
# =========================================================
def field_error(field: str, msg: str, value: Any = None) -> None:
    """
    Raises an HTTPException with a FastAPI-compatible 422 response.
    Ensures all values are JSON serializable.
    """
    if isinstance(value, datetime):
        value = value.isoformat()
    elif not isinstance(value, (str, int, float, bool, type(None))):
        value = str(value)
    raise HTTPException(
        status_code=422,
        detail=[
            {
                "loc": ["body", field],
                "msg": msg,
                "type": "value_error",
                "input": value,
            }
        ],
    )

# -----------------------------------------
# UNIVERSAL INPUT NORMALIZATION
# -----------------------------------------
class NormalizeInputMixin:
    """Normalizes incoming values from frontend:
      - Converts '', ' ', 'null', 'undefined' -> None
      - Strips whitespace
    Applies to all fields automatically.
    """
    @field_validator("*", mode="before")
    @classmethod
    def normalize_input(cls, v: Any):
        if isinstance(v, str):
            cleaned = v.strip().lower()
            if cleaned in {"", "null", "undefined"}:
                return None
            return v.strip()
        return v

# -----------------------------------------
# GENERIC UTC DATETIME FIX
# -----------------------------------------
class UtcDatetimeMixin:
    """Re-attaches UTC tzinfo to any naive datetime read from MongoDB (Motor strips tzinfo on read)."""
    @field_validator("*", mode="before")
    @classmethod
    def ensure_utc_datetimes(cls, v: Any):
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v

# -----------------------------------------
# CROSS-FIELD VALIDATION MIXINS
# -----------------------------------------
class DateValidatorMixin:
    """Ensures end_date >= start_date if both exist."""
    @model_validator(mode="after")
    def validate_dates(self):
        start = getattr(self, "start_date", None)
        end = getattr(self, "end_date", None)
        if start and end and isinstance(start, datetime) and isinstance(end, datetime):
            start_naive = start.replace(tzinfo=None)
            end_naive = end.replace(tzinfo=None)
            if end_naive < start_naive:
                field_error("end_date", "End date cannot be before start date", end)
        return self

class CreditValidatorMixin:
    """Ensures that credit-related fields are valid (used by AiModel)."""
    @model_validator(mode="after")
    def validate_credits(self):
        credits = getattr(self, "credits", None)
        input_cost = getattr(self, "input_tokens_cost", None)
        output_cost = getattr(self, "output_tokens_cost", None)
        if credits is not None and credits < 0:
            field_error("credits", "Credits cannot be negative", credits)
        if input_cost is not None and input_cost < 0:
            field_error("input_tokens_cost", "Input token cost cannot be negative", input_cost)
        if output_cost is not None and output_cost < 0:
            field_error("output_tokens_cost", "Output token cost cannot be negative", output_cost)
        return self

# -----------------------------------------
# DUPLICATE KEY (UNIQUE INDEX) HANDLER
# -----------------------------------------
def handle_duplicate_key(e: DuplicateKeyError, model: Type[Document]) -> HTTPException:
    msg = str(e)
    field = "unknown"
    if "index:" in msg:
        try:
            field = msg.split("index:")[1].split(" ")[1].split("_")[0]
        except Exception as e:
            logger.debug(f"Could not parse field name from duplicate key error: {e}")
    detail = [{
        "loc": ["body", field],
        "msg": f"{field.capitalize()} already exists",
        "type": "value_error.duplicate"
    }]
    return HTTPException(status_code=422, detail=detail)

# -----------------------------------------
# FOREIGN KEY (REFERENCE INTEGRITY) CHECK
# -----------------------------------------
async def ensure_exists(model: Type[Document], field_name: str, value):
    """
    Ensures that referenced document(s) exist.
    - Accepts a single ObjectId or a list of ObjectIds.
    - Raises 422 if any referenced ID does not exist.
    """
    if not value:
        return

    # Handle list of IDs
    if isinstance(value, list):
        missing: List[str] = []
        for v in value:
            if not await model.get(v):
                missing.append(str(v))
        if missing:
            raise HTTPException(
                status_code=422,
                detail=[{
                    "loc": ["body", field_name],
                    "msg": f"Invalid {model.__name__} reference(s): {', '.join(missing)}",
                    "type": "value_error.foreign_key_list"
                }]
            )
        return

    # Handle single reference
    if not await model.get(value):
        raise HTTPException(
            status_code=422,
            detail=[{
                "loc": ["body", field_name],
                "msg": f"Referenced {model.__name__} not found",
                "type": "value_error.foreign_key"
            }]
        )
