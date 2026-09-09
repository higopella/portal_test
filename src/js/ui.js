function toggleDrawerMenu(isOpen) {
  const drawer = document.getElementById("drawer-menu");
  const overlay = document.getElementById("drawer-overlay");
  if (!drawer || !overlay) return;
  drawer.classList.toggle("active", isOpen);
  overlay.classList.toggle("active", isOpen);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function withButtonLoading(button, asyncCallback, loadingText = "通信中...") {
  if (!button || button.disabled) return;
  const originalText = button.textContent;
  button.disabled = true;
  button.classList.add("is-loading");
  button.textContent = loadingText;
  try {
    await asyncCallback();
  } finally {
    button.disabled = false;
    button.classList.remove("is-loading");
    button.textContent = originalText;
  }
}

function showToast(message, type = "info") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "toast-error" : ""}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function initScrollTopButton() {
  const scrollTopBtn = document.getElementById("btn-scroll-top");
  if (!scrollTopBtn) return;

  window.addEventListener("scroll", () => {
    scrollTopBtn.classList.toggle("visible", window.scrollY > 200);
  });
  scrollTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function showModal(titleText, contentElement) {
  closeModal();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "app-modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal-panel";

  const header = document.createElement("div");
  header.className = "modal-header";
  const title = document.createElement("span");
  title.className = "modal-title";
  title.textContent = titleText;
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "btn-close";
  closeBtn.setAttribute("aria-label", "閉じる");
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", closeModal);
  header.appendChild(title);
  header.appendChild(closeBtn);

  const body = document.createElement("div");
  body.className = "modal-body";
  body.appendChild(contentElement);

  modal.appendChild(header);
  modal.appendChild(body);
  overlay.appendChild(modal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  document.body.appendChild(overlay);
}

function closeModal() {
  const existing = document.getElementById("app-modal-overlay");
  if (existing) existing.remove();
}

// カレンダー表示の共通規格（Home・予約ページで共有）
const SCHEDULE_PIXELS_PER_MINUTE = 2;
const SCHEDULE_DAY_START_MINUTES = 7 * 60;
const SCHEDULE_DAY_END_MINUTES = 21 * 60;
const SCHEDULE_LANE_LABEL_WIDTH = 34;
const SCHEDULE_ROOM_ORDER = { "①": 0, "②": 1, "③": 2, "メイン": 3 };
const SCHEDULE_ROOM_NAMES = { "①": "部室", "②": "機材庫", "③": "教室", "メイン": "メイン" };

function getScheduleMinutesFromTime(value) {
  const parts = String(value).split(":").map(Number);
  return parts[0] * 60 + parts[1];
}

function getScheduleRoomPriority(room) {
  return Object.prototype.hasOwnProperty.call(SCHEDULE_ROOM_ORDER, room) ? SCHEDULE_ROOM_ORDER[room] : 99;
}

// 使用中の部屋だけを、部室→機材庫→教室→メインの順で固定レーンに配置する
function layoutScheduleTimedEvents(events, timeline, createEventElement) {
  const activeRooms = [...new Set(events.map((event) => event.room))]
    .sort((a, b) => getScheduleRoomPriority(a) - getScheduleRoomPriority(b));
  const timedEvents = events.filter((event) => !event.isAllDay);
  const laneCount = Math.max(activeRooms.length, 1);

  timedEvents.forEach((event) => {
    const laneIndex = activeRooms.indexOf(event.room);
    const start = getScheduleMinutesFromTime(event.startTime);
    const end = getScheduleMinutesFromTime(event.endTime);
    const element = createEventElement(event, false);
    element.style.top = `${(start - SCHEDULE_DAY_START_MINUTES) * SCHEDULE_PIXELS_PER_MINUTE}px`;
    element.style.height = `${Math.max((end - start) * SCHEDULE_PIXELS_PER_MINUTE, 20)}px`;
    element.style.left = `calc(${SCHEDULE_LANE_LABEL_WIDTH}px + ${(laneIndex / laneCount) * 100}% - ${(laneIndex / laneCount) * SCHEDULE_LANE_LABEL_WIDTH}px)`;
    element.style.width = `calc(${100 / laneCount}% - ${(SCHEDULE_LANE_LABEL_WIDTH / laneCount) + 2}px)`;
    timeline.appendChild(element);
  });
}

function buildScheduleTimeline(className, hourLineClassName, date) {
  const timeline = document.createElement("div");
  timeline.className = className;
  timeline.style.height = `${(SCHEDULE_DAY_END_MINUTES - SCHEDULE_DAY_START_MINUTES) * SCHEDULE_PIXELS_PER_MINUTE}px`;
  for (let minutes = SCHEDULE_DAY_START_MINUTES; minutes < SCHEDULE_DAY_END_MINUTES; minutes += 60) {
    const hourLine = document.createElement("div");
    hourLine.className = hourLineClassName;
    hourLine.style.height = `${60 * SCHEDULE_PIXELS_PER_MINUTE}px`;
    hourLine.textContent = String(Math.floor(minutes / 60));
    timeline.appendChild(hourLine);
  }
  if (date && isScheduleToday(date)) {
    const indicator = document.createElement("div");
    indicator.className = "schedule-current-time-line";
    indicator.setAttribute("aria-hidden", "true");
    timeline.appendChild(indicator);
  }
  return timeline;
}

function isScheduleToday(date) {
  const today = new Date();
  return date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
}

function updateScheduleCurrentTimeIndicators() {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const isVisible = currentMinutes >= SCHEDULE_DAY_START_MINUTES && currentMinutes <= SCHEDULE_DAY_END_MINUTES;
  document.querySelectorAll(".schedule-current-time-line").forEach((indicator) => {
    indicator.style.top = `${(currentMinutes - SCHEDULE_DAY_START_MINUTES) * SCHEDULE_PIXELS_PER_MINUTE}px`;
    indicator.hidden = !isVisible;
  });
}

function scrollScheduleToCurrentTime(container) {
  if (!container || !document.querySelector(".schedule-current-time-line:not([hidden])")) return;
  const indicator = document.querySelector(".schedule-current-time-line:not([hidden])");
  const target = indicator.offsetTop - container.clientHeight * 0.35;
  container.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
}

function startScheduleCurrentTimeUpdates() {
  updateScheduleCurrentTimeIndicators();
  if (window.scheduleCurrentTimeTimer) clearInterval(window.scheduleCurrentTimeTimer);
  window.scheduleCurrentTimeTimer = setInterval(updateScheduleCurrentTimeIndicators, 60 * 1000);
}

function showScheduleEventDetail(event) {
  const body = document.createElement("div");
  const rows = [
    ["時間", event.isAllDay ? "終日" : `${event.startTime} - ${event.endTime}`],
    ["練習場所", SCHEDULE_ROOM_NAMES[event.room] || event.room],
    ["バンド名", event.title || "-"],
    ["代表者", event.repName || "-"],
    ["譲ります", event.transferStatus || "なし"]
  ];
  rows.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "modal-row";
    const labelEl = document.createElement("span");
    labelEl.className = "modal-row-label";
    labelEl.textContent = label;
    const valueEl = document.createElement("span");
    valueEl.className = "modal-row-value";
    valueEl.textContent = value;
    row.appendChild(labelEl);
    row.appendChild(valueEl);
    body.appendChild(row);
  });
  showModal("予約の詳細", body);
}