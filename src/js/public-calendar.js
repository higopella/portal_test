initCommonLayout('calendar');

document.addEventListener('DOMContentLoaded', async () => {
	const host = document.querySelector('[data-schedule-calendar]');
	if (!host) return;

	await initScheduleCalendar({
		host,
		defaultView: 'day',
		loadEvents: async (start, end, forceRefresh) => {
			const result = await callGasApi('getScheduleEvents', {
				startDate: getLocalDateString(start),
				endDate: getLocalDateString(end),
				forceRefresh
			});
			if (!result.success) throw new Error(result.error || '予定の取得に失敗しました');
			return result.events;
		},
		createEventElement: createPublicScheduleEvent
	});
});

function getLocalDateString(date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function createPublicScheduleEvent(event, isAllDay) {
	const element = document.createElement('div');
	element.className = `home-schedule-event schedule-event ${getPublicScheduleRoomClass(event.room)}${isAllDay ? ' home-schedule-event-all-day schedule-event-all-day' : ''}`;
	const title = document.createElement('span');
	title.className = 'home-schedule-event-title';
	title.textContent = event.title;
	element.appendChild(title);
	if (event.transferStatus) {
		const transfer = document.createElement('span');
		transfer.className = 'home-schedule-event-transfer';
		transfer.textContent = event.transferStatus;
		element.appendChild(transfer);
	}
	element.addEventListener('click', () => showScheduleEventDetail(event));
	return element;
}

function getPublicScheduleRoomClass(room) {
	if (room === '②') return 'home-schedule-event-equipment schedule-event-equipment';
	if (room === '③') return 'home-schedule-event-classroom schedule-event-classroom';
	if (room === 'メイン') return 'home-schedule-event-main schedule-event-main';
	return 'home-schedule-event-clubroom schedule-event-clubroom';
}
