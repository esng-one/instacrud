"use client";
import React, { useState, useRef, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { EventInput, EventClickArg, EventContentArg } from "@fullcalendar/core";
import { CalendarService } from "@/api/services/CalendarService";
import { CircularProgress } from "@mui/material";

interface CalendarEvent extends EventInput {
  extendedProps: {
    entity: string;
    entityId: string;
    type: string;
    calendar: string;
  };
}

const MODEL_COLOR_MAP: Record<string, string> = {
  projects: "primary", // blue
};

const Calendar: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const calendarRef = useRef<FullCalendar>(null);

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const events = await CalendarService.getCalendarEventsCalendarGet();

        const mapped = events.map((ev) => ({
          id: ev.id,
          title: ev.title,
          start: ev.start,
          end: ev.end || undefined,
          allDay: true,
          extendedProps: {
            entity: ev.entity,
            entityId: ev.entity_id,
            type: ev.type,
            calendar: MODEL_COLOR_MAP[ev.type] ?? "primary",
          },
        }));

        setEvents(mapped);
      } catch (err) {
        console.error("Failed to fetch calendar events", err);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, []);

  const clampPopover = () => {
    // FullCalendar renders the popover asynchronously; wait for next rAF after it appears
    const tryClamp = (attemptsLeft: number) => {
      const popover = document.querySelector(".fc-popover") as HTMLElement | null;
      if (!popover) {
        if (attemptsLeft > 0) requestAnimationFrame(() => tryClamp(attemptsLeft - 1));
        return;
      }
      const rect = popover.getBoundingClientRect();
      // Clamp against both the FC container edge and the viewport edge
      const fcEl = popover.closest(".fc") as HTMLElement | null;
      const rightBound = Math.min(
        fcEl ? fcEl.getBoundingClientRect().right : window.innerWidth,
        window.innerWidth
      ) - 10;
      const leftBound = (fcEl ? fcEl.getBoundingClientRect().left : 0) + 10;
      if (rect.right > rightBound) {
        popover.style.left = `${popover.offsetLeft - (rect.right - rightBound)}px`;
      }
      if (rect.left < leftBound) {
        popover.style.left = `${popover.offsetLeft + (leftBound - rect.left)}px`;
      }
    };
    requestAnimationFrame(() => tryClamp(10));
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    const { type, entityId } = clickInfo.event.extendedProps;
    const e = clickInfo.jsEvent;
    if (!type || !entityId) return;
    if ((e.ctrlKey || e.metaKey) && e.button === 0) {
      e.preventDefault();
      e.stopPropagation();
      window.open(`/${type}?id=${entityId}`, "_blank");
      return;
    }
    window.location.href = `/${type}?id=${entityId}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <CircularProgress />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border  border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="custom-calendar">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          dayMaxEventRows={3}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridYear,dayGridMonth",
          }}
          height="auto"
          events={events}
          moreLinkClick={clampPopover}
          selectable={false}
          select={() => {}} // Disable date selection
          eventClick={handleEventClick}
          eventContent={renderEventContent}
          eventDidMount={(info) => {
            const el = info.el;
            const { type, entityId } = info.event.extendedProps;
            if (!type || !entityId) return;
            el.addEventListener("mousedown", (e) => {
              if (e.button === 1) {
                e.preventDefault();
                window.open(`/${type}?id=${entityId}`, "_blank");
              }
            });
          }}
        />
      </div>
    </div>
  );
};

const renderEventContent = (eventInfo: EventContentArg) => {
  const colorClass = `fc-bg-${eventInfo.event.extendedProps.calendar.toLowerCase()}`;
  return (
    <div
      className={`event-fc-color flex fc-event-main ${colorClass}`}
      title={eventInfo.event.title}
    >
      <div className="fc-daygrid-event-dot"></div>
      <div className="fc-event-time">{eventInfo.timeText}</div>
      <div className="fc-event-title">{eventInfo.event.title}</div>
    </div>
  );
};

export default Calendar;
