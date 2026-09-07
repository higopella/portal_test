initCommonLayout('booking');

let scheduleView = 'week';
let scheduleAnchorDate = new Date();

document.addEventListener('DOMContentLoaded', async () => {
	if (!await requirePageAuthentication()) return;
	const today = getLocalDateString(new Date());
	document.getElementById('book-date').value = today;
	document.getElementById('tab-btn-create').addEventListener('click', () => switchTab('create'));
	document.getElementById('tab-btn-search').addEventListener('click', () => switchTab('search'));
	document.getElementById('form-booking').addEventListener('submit', (event) => { event.preventDefault(); handleAddBooking(); });
	document.getElementById('form-search').addEventListener('submit', (event) => { event.preventDefault(); handleSearch(); });
	document.getElementById('book-start-time').addEventListener('change', updateEndTimePreview);
	document.getElementById('book-duration').addEventListener('change', updateEndTimePreview);
	document.getElementById('schedule-view-week').addEventListener('click', () => setScheduleView('week'));
	document.getElementById('schedule-view-month').addEventListener('click', () => setScheduleView('month'));
	document.getElementById('schedule-prev').addEventListener('click', () => moveSchedulePeriod(-1));
	document.getElementById('schedule-next').addEventListener('click', () => moveSchedulePeriod(1));
	document.getElementById('btn-refresh-schedule').addEventListener('click', () => loadBookingSchedule(true));
	updateEndTimePreview();
	loadBookingSchedule();
});

function getLocalDateString(date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function getScheduleRange() {
	const anchor = new Date(scheduleAnchorDate.getFullYear(), scheduleAnchorDate.getMonth(), scheduleAnchorDate.getDate());
	if (scheduleView === 'month') {
		const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
		const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
		return { start, end };
	}
	const weekday = anchor.getDay();
	const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
	const start = new Date(anchor);
	start.setDate(start.getDate() + mondayOffset);
	const end = new Date(start);
	end.setDate(end.getDate() + 6);
	return { start, end };
}

function setScheduleView(view) {
	scheduleView = view;
	document.getElementById('schedule-view-week').classList.toggle('active', view === 'week');
	document.getElementById('schedule-view-month').classList.toggle('active', view === 'month');
	loadBookingSchedule();
}

function moveSchedulePeriod(direction) {
	if (scheduleView === 'month') scheduleAnchorDate.setMonth(scheduleAnchorDate.getMonth() + direction);
	else scheduleAnchorDate.setDate(scheduleAnchorDate.getDate() + direction * 7);
	loadBookingSchedule();
}

async function loadBookingSchedule(forceRefresh = false) {
	const container = document.getElementById('booking-schedule');
	const button = document.getElementById('btn-refresh-schedule');
	const range = getScheduleRange();
	const startDate = getLocalDateString(range.start);
	const endDate = getLocalDateString(range.end);
	document.getElementById('schedule-period-label').textContent = scheduleView === 'month'
		? `${range.start.getFullYear()}年${range.start.getMonth() + 1}月`
		: `${range.start.getMonth() + 1}/${range.start.getDate()} - ${range.end.getMonth() + 1}/${range.end.getDate()}`;
	container.textContent = '';
	const loading = document.createElement('div');
	loading.className = 'schedule-message';
	loading.textContent = '読み込み中...';
	container.appendChild(loading);

	if (forceRefresh) button.disabled = true;
	try {
		const result = await callGasApi('getScheduleEvents', { startDate, endDate, forceRefresh });
		renderBookingSchedule(result.success ? result.events : [], range);
	} catch (error) {
		container.textContent = '';
		const message = document.createElement('div');
		message.className = 'schedule-message search-message-error';
		message.textContent = '予定の取得に失敗しました。';
		container.appendChild(message);
	} finally {
		if (forceRefresh) button.disabled = false;
	}
}

function renderBookingSchedule(events, range) {
	const container = document.getElementById('booking-schedule');
	const eventsByDate = {};
	events.forEach((event) => {
		const date = String(event.start || '').slice(0, 10);
		if (!eventsByDate[date]) eventsByDate[date] = [];
		eventsByDate[date].push(event);
	});
	container.textContent = '';
	for (const day = new Date(range.start); day <= range.end; day.setDate(day.getDate() + 1)) {
		const dateKey = getLocalDateString(day);
		const dayElement = document.createElement('div');
		dayElement.className = 'schedule-day';
		const heading = document.createElement('div');
		heading.className = 'schedule-day-title';
		heading.textContent = `${day.getMonth() + 1}/${day.getDate()} (${['日', '月', '火', '水', '木', '金', '土'][day.getDay()]})`;
		dayElement.appendChild(heading);
		const dayEvents = eventsByDate[dateKey] || [];
		if (dayEvents.length === 0) {
			const empty = document.createElement('div');
			empty.className = 'schedule-empty';
			empty.textContent = '予約なし';
			dayElement.appendChild(empty);
		}
		dayEvents.forEach((event) => {
			const eventElement = document.createElement('div');
			eventElement.className = 'schedule-event';
			const time = document.createElement('span');
			time.className = 'schedule-event-time';
			time.textContent = `${event.startTime} - ${event.endTime} ${event.room}`;
			const title = document.createElement('span');
			title.textContent = event.title;
			eventElement.appendChild(time);
			eventElement.appendChild(title);
			dayElement.appendChild(eventElement);
		});
		container.appendChild(dayElement);
	}
}

function switchTab(tabKey) {
	const isCreate = tabKey === 'create';
	document.getElementById('panel-create').style.display = isCreate ? 'block' : 'none';
	document.getElementById('panel-search').style.display = isCreate ? 'none' : 'block';
	document.getElementById('tab-btn-create').classList.toggle('active', isCreate);
	document.getElementById('tab-btn-search').classList.toggle('active', !isCreate);
}

function updateEndTimePreview() {
	const timeVal = document.getElementById('book-start-time').value;
	const durationVal = parseInt(document.getElementById('book-duration').value, 10);
	const previewEl = document.getElementById('end-time-preview');

	if (!timeVal) {
		previewEl.textContent = '開始時刻を選択してください';
		return;
	}

	const [h, m] = timeVal.split(':').map(Number);
	const startDate = new Date();
	startDate.setHours(h, m, 0, 0);

	const endDate = new Date(startDate.getTime() + durationVal * 60000);
	const endHours = String(endDate.getHours()).padStart(2, '0');
	const endMinutes = String(endDate.getMinutes()).padStart(2, '0');

	previewEl.textContent = `終了予定: ${endHours}:${endMinutes}`;
}

async function handleAddBooking() {
	const date = document.getElementById('book-date').value;
	const room = document.getElementById('book-room').value;
	const startTime = document.getElementById('book-start-time').value;
	const duration = parseInt(document.getElementById('book-duration').value, 10);
	const bandName = document.getElementById('book-band-name').value.trim();
	const repName = document.getElementById('book-rep-name').value.trim();
	const transferStatus = document.getElementById('book-transfer').value;
	const btn = document.getElementById('btn-submit-booking');

	const startDateTime = new Date(`${date.replace(/-/g, '/')} ${startTime}:00`);
	const now = new Date();
	if (startDateTime <= now) {
		showToast('過去の日時は予約できません', 'error');
		return;
	}

	const maxDate = new Date();
	maxDate.setMonth(maxDate.getMonth() + 1);
	maxDate.setHours(23, 59, 59, 999);
	if (startDateTime > maxDate) {
		showToast('1ヶ月より先の予約はできません', 'error');
		return;
	}

	const endDateTime = new Date(startDateTime.getTime() + duration * 60000);
	const limit18 = new Date(startDateTime);
	limit18.setHours(18, 0, 0, 0);
	if (endDateTime > limit18 && duration > 90) {
		showToast('18:00を超える予約は最大90分までです', 'error');
		return;
	}

	const payloadData = { date, room, startTime, duration, bandName, repName, transferStatus };

	await withButtonLoading(btn, async () => {
		const res = await callGasApi('addEventToCalendar', payloadData);
		if (res.success) {
			showToast('予約が完了しました');
			document.getElementById('form-booking').reset();
			document.getElementById('book-date').value = new Date().toISOString().split('T')[0];
			updateEndTimePreview();
		} else {
			showToast(res.error || '予約に失敗しました', 'error');
		}
	}, '予約中...');
}

async function handleSearch() {
	const date = document.getElementById('search-date').value;
	const bandName = document.getElementById('search-band-name').value.trim();
	const btn = document.getElementById('btn-search-booking');
	const resultsContainer = document.getElementById('search-results');

	await withButtonLoading(btn, async () => {
		resultsContainer.textContent = '';
		const loading = document.createElement('div');
		loading.className = 'search-message';
		loading.textContent = '検索中...';
		resultsContainer.appendChild(loading);
		const res = await callGasApi('findEvents', { date, bandName });

		if (!res.success || !res.events || res.events.length === 0) {
			resultsContainer.textContent = '';
			const empty = document.createElement('div');
			empty.className = 'search-message';
			empty.textContent = '該当する予約が見つかりません';
			resultsContainer.appendChild(empty);
			return;
		}

		resultsContainer.textContent = '';
		res.events.forEach((ev) => {
			const card = document.createElement('div');
			card.className = 'event-card';
			const info = document.createElement('div');
			const title = document.createElement('div');
			title.className = 'event-title';
			title.textContent = ev.title;
			const time = document.createElement('div');
			time.className = 'event-time';
			time.textContent = `${ev.startStr} (${ev.duration}分)`;
			const deleteBtn = document.createElement('button');
			deleteBtn.type = 'button';
			deleteBtn.className = 'btn btn-danger delete-booking-button';
			deleteBtn.textContent = '削除';
			deleteBtn.addEventListener('click', () => handleDeleteBooking(ev.id, deleteBtn));
			info.appendChild(title);
			info.appendChild(time);
			card.appendChild(info);
			card.appendChild(deleteBtn);
			resultsContainer.appendChild(card);
		});
	}, '検索中...');
}

async function handleDeleteBooking(eventId, buttonEl) {
	if (!confirm('本当にこの予約を削除しますか？')) return;

	await withButtonLoading(buttonEl, async () => {
		const res = await callGasApi('deleteEventById', { eventId });
		if (res.success) {
			showToast('予約を削除しました');
			const card = buttonEl.closest('.event-card');
			if (card) card.remove();
		} else {
			showToast(res.error || '削除に失敗しました', 'error');
		}
	}, '削除中...');
}
