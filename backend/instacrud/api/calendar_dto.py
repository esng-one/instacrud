from pydantic import BaseModel
from typing import Optional

class CalendarEvent(BaseModel):
    id: str
    entity: str
    entity_id: str
    title: str
    type: str
    start: str   # YYYY-MM-DD — plain date so FullCalendar shows correct calendar date regardless of browser TZ
    end: Optional[str] = None
