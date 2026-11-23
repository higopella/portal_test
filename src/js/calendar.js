const SCHEDULE_TEMPLATE_URL = "src/calendar.html";
const SCHEDULE_REVISION_POLL_MS = 2 * 60 * 1000;
const SCHEDULE_REVISION_MIN_GAP_MS = 30 * 1000;

function getScheduleTemplateUrl() {
  const host = document.querySelector("[data-schedule-calendar]");
  return host?.dataset.scheduleTemplate || SCHEDULE_TEMPLATE_URL;
}

function getScheduleBookingUrl() {
  if (window.location.pathname.includes("/booking/")) return "#";
  const host = document.querySelector("[data-schedule-calendar]");
  return `${host?.dataset.scheduleBookingUrl || "booking/"}?new=1`;
}

async function initScheduleCalendar({ host, loadEvents, createEventElement, defaultView = "week", onRendered }) {
  if (!host) return null;
  const templateResponse = await fetch(getScheduleTemplateUrl(), { cache: "no-cache" });
  if (!templateResponse.ok) throw new Error("カレンダーテンプレートを読み込めませんでした。再読み込みしてください");
  host.innerHTML = await templateResponse.text();

  const container = host.querySelector("[data-schedule-container]");
  const periodLabel = host.querySelector("[data-schedule-period]");
  const bookingUrl = getScheduleBookingUrl();
  host.querySelectorAll(".schedule-booking-link").forEach((link) => { link.href = bookingUrl; });
  watchScheduleStickyOffset(host, container);

  const state = { view: defaultView, anchorDate: new Date() };
  let latestRequestId = 0;
  let knownRevision = "";
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

  // 取得した期間の予定は置き換える（結合すると他の人が削除した予定が残る）
  const replaceRangeEvents = (baseEvents, newEvents, start, end) => {
    const outside = (baseEvents || []).filter((event) => {
      const eventDate = String(event.start || "").slice(0, 10);
      return eventDate < start || eventDate > end;
    });
    return [...outside, ...(newEvents || [])];
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

  async function refresh(forceRefresh = false, ignoreFreshCache = false) {
    const requestId = ++latestRequestId;
    const dates = getDates();
    const range = getRequestRange();
    const cached = forceRefresh ? null : await readScheduleDeviceCache();
    const requestedStart = getScheduleDateString(range.start);
    const requestedEnd = getScheduleDateString(range.end);
    const hasCachedEvents = cached && cached.version === SCHEDULE_DEVICE_CACHE_VERSION &&
      Array.isArray(cached.events);
    if (requestId !== latestRequestId) return;
    if (hasCachedEvents) {
      renderEvents(cached.events, dates);
      const cacheCoversRange = cached.windowStart <= requestedStart && cached.windowEnd >= requestedEnd;
      const cacheIsFresh = Date.now() - Number(cached.fetchedAt || 0) < SCHEDULE_DEVICE_CACHE_TTL_MS;
      if (!forceRefresh && !ignoreFreshCache && cacheCoversRange && cacheIsFresh) {
        if (cached.revision) knownRevision = cached.revision;
        return;
      }
    } else {
      container.textContent = "";
      const loading = document.createElement("div");
      loading.className = "schedule-message";
      loading.textContent = "読み込み中...";
      container.appendChild(loading);
    }
    const networkPromise = loadEvents(range.start, range.end, forceRefresh);
    try {
      const loaded = await withScheduleRefreshTimeout(networkPromise);
      if (requestId !== latestRequestId) return;
      const activeEvents = Array.isArray(loaded) ? loaded : (loaded?.events || []);
      if (loaded?.revision) knownRevision = loaded.revision;
      const mergedEvents = replaceRangeEvents(cached?.events, activeEvents, requestedStart, requestedEnd);
      renderEvents(mergedEvents, dates);
      await writeScheduleDeviceCache({
        version: SCHEDULE_DEVICE_CACHE_VERSION,
        sessionId: cacheSessionId,
        requestId,
        windowStart: getScheduleDateString(range.start),
        windowEnd: getScheduleDateString(range.end),
        fetchedAt: Date.now(),
        revision: knownRevision,
        events: mergedEvents
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

  let revisionCheckInFlight = false;
  let lastRevisionCheckAt = 0;
  // 表示中のみ変更番号だけを確認し、変わった時だけ予定を取り直す
  async function checkScheduleRevision() {
    if (document.hidden || revisionCheckInFlight || !knownRevision || typeof callGasApi !== "function") return;
    revisionCheckInFlight = true;
    lastRevisionCheckAt = Date.now();
    try {
      const result = await callGasApi("getScheduleRevision");
      if (result?.success && result.revision && result.revision !== knownRevision) {
        knownRevision = result.revision;
        await refresh(false, true);
      }
    } catch (error) {
      // Next poll retries.
    } finally {
      revisionCheckInFlight = false;
    }
  }
  setInterval(checkScheduleRevision, SCHEDULE_REVISION_POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && Date.now() - lastRevisionCheckAt >= SCHEDULE_REVISION_MIN_GAP_MS) checkScheduleRevision();
  });

  return { refresh, state };
}

// ページスクロールでカレンダー上端がツールバーの下に潜った分だけ、曜日・終日の行を下げて見える位置に留める
function watchScheduleStickyOffset(host, container) {
  const toolbar = host.querySelector(".schedule-toolbar");
  if (!toolbar || !container) return;
  let frame = 0;
  const update = () => {
    frame = 0;
    const hidden = toolbar.getBoundingClientRect().bottom - container.getBoundingClientRect().top;
    const offset = Math.max(0, Math.min(hidden, container.clientHeight - 80));
    container.style.setProperty("--schedule-sticky-offset", `${Math.round(offset)}px`);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  document.addEventListener("scroll", schedule, { capture: true, passive: true });
  window.addEventListener("resize", schedule);
  update();
}

function moveScheduleAnchorDate(state, direction) {
  if (state.view === "month") state.anchorDate.setMonth(state.anchorDate.getMonth() + direction);
  else if (state.view === "day") state.anchorDate.setDate(state.anchorDate.getDate() + direction);
  else if (state.view === "3day") state.anchorDate.setDate(state.anchorDate.getDate() + direction * 3);
  else state.anchorDate.setDate(state.anchorDate.getDate() + direction * 7);
}
