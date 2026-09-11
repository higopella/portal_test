const SCHEDULE_TEMPLATE_URL = "src/calendar.html";

function getScheduleTemplateUrl() {
  const host = document.querySelector("[data-schedule-calendar]");
  return host?.dataset.scheduleTemplate || SCHEDULE_TEMPLATE_URL;
}

function getScheduleBookingUrl() {
  return window.location.pathname.includes("/booking/") ? "../booking/" : "booking/";
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

  async function refresh(forceRefresh = false) {
    const dates = getDates();
    const range = getRequestRange();
    container.textContent = "";
    const loading = document.createElement("div");
    loading.className = "schedule-message";
    loading.textContent = "読み込み中...";
    container.appendChild(loading);
    try {
      const events = await loadEvents(range.start, range.end, forceRefresh);
      renderScheduleCalendar(container, events || [], dates, state.view, createEventElement, "schedule");
      periodLabel.textContent = formatSchedulePeriod(state.view, dates);
      host.querySelectorAll("[data-schedule-view]").forEach((button) => {
        button.classList.toggle("active", button.dataset.scheduleView === state.view);
      });
      onRendered?.(state, dates);
    } catch (error) {
      container.textContent = "";
      const message = document.createElement("div");
      message.className = "schedule-message schedule-message-error";
      message.textContent = "予定の取得に失敗しました。";
      container.appendChild(message);
      throw error;
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
  host.querySelector('[data-schedule-action="refresh"]')?.addEventListener("click", () => refresh(true));

  await refresh();
  return { refresh, state };
}

function moveScheduleAnchorDate(state, direction) {
  if (state.view === "month") state.anchorDate.setMonth(state.anchorDate.getMonth() + direction);
  else if (state.view === "day") state.anchorDate.setDate(state.anchorDate.getDate() + direction);
  else state.anchorDate.setDate(state.anchorDate.getDate() + direction * 7);
}
