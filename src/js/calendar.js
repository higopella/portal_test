const SCHEDULE_TEMPLATE_URL = "src/calendar.html";
const SCHEDULE_CACHE_PAST_DAYS = 10;
const SCHEDULE_CACHE_FUTURE_DAYS = 90;

function getScheduleTemplateUrl() {
  const host = document.querySelector("[data-schedule-calendar]");
  return host?.dataset.scheduleTemplate || SCHEDULE_TEMPLATE_URL;
}

function getScheduleBookingUrl() {
  return window.location.pathname.includes("/booking/") ? "#" : "booking/";
}

function getScheduleDeviceCacheRange(range) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  start.setDate(start.getDate() - SCHEDULE_CACHE_PAST_DAYS);
  const end = new Date(start);
  end.setDate(end.getDate() + SCHEDULE_CACHE_PAST_DAYS + SCHEDULE_CACHE_FUTURE_DAYS);
  if (range.end >= start && range.start <= end) return { start, end };
  return range;
}

async function loadScheduleRangeInChunks(loadEvents, start, end, forceRefresh) {
  const chunks = [];
  let cursor = new Date(start);
  while (cursor <= end) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setDate(chunkEnd.getDate() + 30);
    if (chunkEnd > end) chunkEnd.setTime(end.getTime());
    chunks.push({ start: new Date(cursor), end: chunkEnd });
    cursor = new Date(chunkEnd);
    cursor.setDate(cursor.getDate() + 1);
  }
  const chunkEvents = await Promise.all(chunks.map((chunk) =>
    loadEvents(chunk.start, chunk.end, forceRefresh)
  ));
  const uniqueEvents = new Map();
  chunkEvents.flat().forEach((event) => {
    const key = `${event.room}|${event.start}|${event.end}|${event.title}`;
    uniqueEvents.set(key, event);
  });
  return [...uniqueEvents.values()];
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
    const dates = getDates();
    const range = getRequestRange();
    const fetchRange = getScheduleDeviceCacheRange(range);
    const cached = forceRefresh ? null : await readScheduleDeviceCache();
    const hasCachedEvents = cached && cached.version === SCHEDULE_DEVICE_CACHE_VERSION &&
      cached.startDate <= getScheduleDateString(fetchRange.start) &&
      cached.endDate >= getScheduleDateString(fetchRange.end);
    if (hasCachedEvents) {
      renderEvents(cached.events, dates);
    } else {
      container.textContent = "";
      const loading = document.createElement("div");
      loading.className = "schedule-message";
      loading.textContent = "読み込み中...";
      container.appendChild(loading);
    }
    const networkPromise = loadScheduleRangeInChunks(loadEvents, fetchRange.start, fetchRange.end, true);
    try {
      const events = await withScheduleRefreshTimeout(networkPromise);
      await writeScheduleDeviceCache({
        version: SCHEDULE_DEVICE_CACHE_VERSION,
        startDate: getScheduleDateString(fetchRange.start),
        endDate: getScheduleDateString(fetchRange.end),
        fetchedAt: Date.now(),
        events: events || []
      });
      renderEvents(events || [], dates);
    } catch (error) {
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
