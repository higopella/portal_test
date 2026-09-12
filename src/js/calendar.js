const SCHEDULE_TEMPLATE_URL = "src/calendar.html";
const SCHEDULE_CACHE_FUTURE_DAYS = 30;

function getScheduleTemplateUrl() {
  const host = document.querySelector("[data-schedule-calendar]");
  return host?.dataset.scheduleTemplate || SCHEDULE_TEMPLATE_URL;
}

function getScheduleBookingUrl() {
  return window.location.pathname.includes("/booking/") ? "#" : "booking/";
}

async function initScheduleCalendar({ host, loadEvents, createEventElement, onRendered }) {
  if (!host) return null;
  const templateResponse = await fetch(getScheduleTemplateUrl(), { cache: "no-cache" });
  if (!templateResponse.ok) throw new Error("カレンダーテンプレートを読み込めませんでした");
  host.innerHTML = await templateResponse.text();

  const container = host.querySelector("[data-schedule-container]");
  const periodLabel = host.querySelector("[data-schedule-period]");
  const bookingLink = host.querySelector(".schedule-booking-link");
  if (bookingLink) bookingLink.href = getScheduleBookingUrl();

  const state = { view: "week", anchorDate: new Date() };
  let latestRequestId = 0;
  const cacheSessionId = `${Date.now()}-${Math.random()}`;
  const getDates = () => getScheduleCalendarDates(state.view, state.anchorDate);
  const getRequestRange = () => {
    if (state.view === "month") {
      return {
        start: new Date(state.anchorDate.getFullYear(), state.anchorDate.getMonth(), 1),
        end: new Date(state.anchorDate.getFullYear(), state.anchorDate.getMonth() + 1, 0)
      };
    }
    const dates = getDates();
    return { start: dates[0], end: dates[dates.length - 1] };
  };

  const getTodayWindow = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + SCHEDULE_CACHE_FUTURE_DAYS);
    return { start, end };
  };

  const mergeScheduleEvents = (baseEvents, newEvents) => {
    const merged = new Map();
    [...(baseEvents || []), ...(newEvents || [])].forEach((event) => {
      const key = `${event.room}|${event.start}|${event.end}|${event.title}`;
      merged.set(key, event);
    });
    return [...merged.values()];
  };

  const renderEvents = (events, dates) => {
    const requestedStart = getScheduleDateString(dates[0]);
    const requestedEnd = getScheduleDateString(dates[dates.length - 1]);
    const visibleEvents = events.filter((event) => {
      const eventDate = String(event.start || "").slice(0, 10);
      return eventDate >= requestedStart && eventDate <= requestedEnd;
    });
    renderScheduleCalendar(container, visibleEvents, dates, state.view, createEventElement, "schedule");
    periodLabel.textContent = formatSchedulePeriod(state.view, dates);
    host.querySelectorAll("[data-schedule-view]").forEach((button) => {
      button.classList.toggle("active", button.dataset.scheduleView === state.view);
    });
    onRendered?.(state, dates);
  };

  async function refresh(forceRefresh = false) {
    const requestId = ++latestRequestId;
    const dates = getDates();
    const range = getRequestRange();
    const cacheWindow = getTodayWindow();
    const cached = forceRefresh ? null : await readScheduleDeviceCache();
    const windowStart = getScheduleDateString(cacheWindow.start);
    const windowEnd = getScheduleDateString(cacheWindow.end);
    const hasCachedEvents = cached && cached.version === SCHEDULE_DEVICE_CACHE_VERSION &&
      Array.isArray(cached.events) &&
      cached.windowStart === windowStart && cached.windowEnd === windowEnd;
    if (requestId !== latestRequestId) return;
    if (hasCachedEvents) {
      renderEvents(cached.events, dates);
    } else {
      container.textContent = "";
      const loading = document.createElement("div");
      loading.className = "schedule-message";
      loading.textContent = "読み込み中...";
      container.appendChild(loading);
    }
    const networkRange = hasCachedEvents ? range : cacheWindow;
    const networkPromise = loadEvents(networkRange.start, networkRange.end, true);
    try {
      const events = await withScheduleRefreshTimeout(networkPromise);
      if (requestId !== latestRequestId) return;
      const allEvents = hasCachedEvents && networkRange !== cacheWindow
        ? mergeScheduleEvents(cached.events, events)
        : events || [];
      renderEvents(allEvents, dates);
      await writeScheduleDeviceCache({
        version: SCHEDULE_DEVICE_CACHE_VERSION,
        sessionId: cacheSessionId,
        requestId,
        windowStart,
        windowEnd,
        fetchedAt: Date.now(),
        events: allEvents
      });
    } catch (error) {
      if (requestId !== latestRequestId) return;
      if (!hasCachedEvents) {
        container.textContent = "";
        const message = document.createElement("div");
        message.className = "schedule-message schedule-message-error";
        message.textContent = "予定の取得に失敗しました。";
        container.appendChild(message);
      }
    }
  }

  host.querySelectorAll("[data-schedule-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.scheduleView;
      refresh();
    });
  });
  host.querySelector('[data-schedule-action="today"]')?.addEventListener("click", () => {
    state.anchorDate = new Date();
    refresh();
  });
  host.querySelector('[data-schedule-action="prev"]')?.addEventListener("click", () => {
    moveScheduleAnchorDate(state, -1);
    refresh();
  });
  host.querySelector('[data-schedule-action="next"]')?.addEventListener("click", () => {
    moveScheduleAnchorDate(state, 1);
    refresh();
  });
  await refresh();
  return { refresh, state };
}

function moveScheduleAnchorDate(state, direction) {
  if (state.view === "month") state.anchorDate.setMonth(state.anchorDate.getMonth() + direction);
  else if (state.view === "day") state.anchorDate.setDate(state.anchorDate.getDate() + direction);
  else state.anchorDate.setDate(state.anchorDate.getDate() + direction * 7);
}
