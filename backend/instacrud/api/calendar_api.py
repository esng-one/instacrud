from fastapi import APIRouter
from typing import List
from datetime import date, datetime
from instacrud.api.calendar_dto import CalendarEvent
from instacrud.model.organization_model import Project


def _to_date_str(value) -> str:
    """Return YYYY-MM-DD from a date, datetime, or ISO string — always the calendar date stored in the value."""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, str):
        return value[:10]
    return str(value)[:10]

router = APIRouter(prefix="/calendar", tags=["calendar"])

CALENDAR_MODELS = [
    {
        "model": Project,
        "type": "projects",
        "title_field": "name",
        "start_field": "start_date",
        "end_field": "end_date",
    },
]

@router.get("", response_model=List[CalendarEvent])
async def get_calendar_events():
    events = []

    for entry in CALENDAR_MODELS:
        model = entry.get("model")
        model_name = model.__name__.lower()
        type = entry.get("type")
        title_field = entry.get("title_field")
        start_field = entry.get("start_field")
        end_field = entry.get("end_field")

        docs = await model.find_all().to_list()

        for doc in docs:
            title = getattr(doc, title_field)
            start = getattr(doc, start_field)
            end = getattr(doc, end_field, None) if end_field else None

            # If model has end_field → use prefix
            if end_field:
                start_title = f"Start: {title}"
                end_title = f"End: {title}"
            else:
                start_title = title
                end_title = title

            if start:
                events.append(CalendarEvent(
                    id=f"{model_name}-start-{doc.id}",
                    entity=model_name,
                    entity_id=str(doc.id),
                    title=start_title,
                    type=type,
                    start=_to_date_str(start),
                ))

                if end:
                    events.append(CalendarEvent(
                        id=f"{model_name}-end-{doc.id}",
                        entity=model_name,
                        entity_id=str(doc.id),
                        title=end_title,
                        type=type,
                        start=_to_date_str(end),
                    ))

    return events
