initCommonLayout('home');

const GOOGLE_OAUTH_CLIENT_ID = '65097864960-vbe2ukqcoi9mpqc9capgtu9mak6vf4qs.apps.googleusercontent.com';

function renderHomeView() {
	const loginSec = document.getElementById('login-section');
	const mainSec = document.getElementById('main-section');
	if (!loginSec || !mainSec) return;

	if (getCurrentIdToken()) {
		loginSec.style.display = 'none';
		mainSec.style.display = 'flex';
		calcNextMeeting();
		fetchNotices();
		fetchHomeSchedule();
	} else {
		loginSec.style.display = 'block';
		mainSec.style.display = 'none';
	}
}

document.addEventListener('DOMContentLoaded', () => {
	if (getCurrentIdToken()) setUserLogin(true);
	initializeGoogleLogin();

	const refreshNoticeBtn = document.getElementById('btn-refresh-notice');
	if (refreshNoticeBtn) {
		refreshNoticeBtn.addEventListener('click', refreshNotices);
	}

	const refreshScheduleBtn = document.getElementById('btn-refresh-schedule');
	if (refreshScheduleBtn) refreshScheduleBtn.addEventListener('click', () => refreshHomeSchedule());

	renderHomeView();
});
window.addEventListener('pageshow', renderHomeView);

function initializeGoogleLogin() {
	const buttonContainer = document.getElementById('google-login-button');
	if (!buttonContainer) return;
	if (!window.google || !google.accounts || !google.accounts.id) {
		const googleScript = document.getElementById('google-identity-script');
		if (googleScript) googleScript.addEventListener('load', initializeGoogleLogin, { once: true });
		return;
	}

	google.accounts.id.initialize({
		client_id: GOOGLE_OAUTH_CLIENT_ID,
		callback: handleGoogleCredential
	});
	google.accounts.id.renderButton(buttonContainer, { theme: 'outline', size: 'large', width: 280 });
}

async function handleGoogleCredential(response) {
	if (!response || !response.credential) {
		showToast('Google認証に失敗しました', 'error');
		return;
	}

	setCurrentIdToken(response.credential);
	try {
		const result = await callGasApi('authenticateGoogle', { idToken: response.credential });
		if (result.status === 'authenticated') {
			setUserLogin(true);
			showToast('ログインしました');
			renderHomeView();
			return;
		}
		if (result.status === 'unregistered') {
			window.location.assign('signup/');
			return;
		}
		clearCurrentIdToken();
		showToast(result.error || 'ログインできません', 'error');
	} catch (error) {
		clearCurrentIdToken();
		showToast('認証に失敗しました', 'error');
	}
}

function calcNextMeeting() {
	const today = new Date();
	let targetDate = null;

	for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
		let year = today.getFullYear();
		let month = today.getMonth() + monthOffset;
		let tuesdayCount = 0;

		for (let day = 1; day <= 31; day++) {
			let checkDate = new Date(year, month, day);
			if (checkDate.getMonth() !== (month % 12)) break;
			if (checkDate.getDay() === 2) {
				tuesdayCount++;
				if (tuesdayCount === 2) {
					if (checkDate >= new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
						targetDate = checkDate;
						break;
					}
				}
			}
		}
		if (targetDate) break;
	}

	if (targetDate) {
		const str = `${targetDate.getMonth() + 1}¥/${targetDate.getDate()}(火) 18:30〜`;
		document.getElementById('next-meeting-text').textContent = str;
	}
}

async function refreshNotices() {
	const btn = document.getElementById('btn-refresh-notice');
	await withButtonLoading(btn, fetchNotices, '更新中');
}

function getLocalDateString(date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

async function refreshHomeSchedule() {
	const button = document.getElementById('btn-refresh-schedule');
	await withButtonLoading(button, () => fetchHomeSchedule(true), '更新中');
}

async function fetchHomeSchedule(forceRefresh = false) {
	const container = document.getElementById('home-schedule');
	if (!container) return;
	const todayDate = new Date();
	const tomorrowDate = new Date(todayDate);
	tomorrowDate.setDate(tomorrowDate.getDate() + 1);
	const today = getLocalDateString(todayDate);
	const tomorrow = getLocalDateString(tomorrowDate);
	container.textContent = '';
	const loading = document.createElement('div');
	loading.className = 'schedule-message';
	loading.textContent = '読み込み中...';
	container.appendChild(loading);

	try {
		const result = await callGasApi('getScheduleEvents', { startDate: today, endDate: tomorrow, forceRefresh: forceRefresh });
		renderHomeSchedule(result.success ? result.events : [], [todayDate, tomorrowDate]);
	} catch (error) {
		container.textContent = '';
		const message = document.createElement('div');
		message.className = 'schedule-message notice-message-error';
		message.textContent = '予定の取得に失敗しました。';
		container.appendChild(message);
	}
}

function renderHomeSchedule(events, dates) {
	const container = document.getElementById('home-schedule');
	const eventsByDate = {};
	events.forEach((event) => {
		const date = String(event.start || '').slice(0, 10);
		if (!eventsByDate[date]) eventsByDate[date] = [];
		eventsByDate[date].push(event);
	});

	container.textContent = '';
	const grid = document.createElement('div');
	grid.className = 'home-schedule-grid';
	dates.forEach((date) => {
		const dateKey = getLocalDateString(date);
		const day = document.createElement('section');
		day.className = 'home-schedule-day';
		const heading = document.createElement('h3');
		heading.className = 'home-schedule-day-title';
		heading.textContent = `${date.getMonth() + 1}/${date.getDate()} (${['日', '月', '火', '水', '木', '金', '土'][date.getDay()]})`;
		day.appendChild(heading);

		const dayEvents = eventsByDate[dateKey] || [];
		const allDay = document.createElement('div');
		allDay.className = 'home-schedule-all-day';
		dayEvents.filter((event) => event.isAllDay).forEach((event) => allDay.appendChild(createHomeScheduleEvent(event, true)));
		day.appendChild(allDay);

		const timeline = document.createElement('div');
		timeline.className = 'home-schedule-timeline';
		for (let hour = 7; hour < 21; hour += 1) {
			const hourLine = document.createElement('div');
			hourLine.className = 'home-schedule-hour-line';
			hourLine.textContent = `${String(hour).padStart(2, '0')}:00`;
			timeline.appendChild(hourLine);
		}
		layoutHomeTimedEvents(dayEvents.filter((event) => !event.isAllDay), timeline);
		if (dayEvents.length === 0) {
			const empty = document.createElement('div');
			empty.className = 'home-schedule-empty';
			empty.textContent = '予約なし';
			timeline.appendChild(empty);
		}
		day.appendChild(timeline);
		grid.appendChild(day);
	});
	container.appendChild(grid);
}

function createHomeScheduleEvent(event, isAllDay) {
	const element = document.createElement('div');
	element.className = `home-schedule-event ${getHomeScheduleRoomClass(event.room)}${isAllDay ? ' home-schedule-event-all-day' : ''}`;
	const time = document.createElement('span');
	time.className = 'home-schedule-event-time';
	time.textContent = isAllDay ? '終日' : `${event.startTime} - ${event.endTime}`;
	const room = document.createElement('span');
	room.className = 'home-schedule-room';
	room.textContent = event.room;
	const title = document.createElement('span');
	title.textContent = event.title;
	element.appendChild(time);
	element.appendChild(room);
	element.appendChild(title);
	return element;
}

function getHomeScheduleRoomClass(room) {
	if (room === '②') return 'home-schedule-event-equipment';
	if (room === '③') return 'home-schedule-event-classroom';
	if (room === 'メイン') return 'home-schedule-event-main';
	return 'home-schedule-event-clubroom';
}

function layoutHomeTimedEvents(events, timeline) {
	const groups = [];
	events.slice().sort((first, second) => first.start.localeCompare(second.start)).forEach((event) => {
		const start = getMinutesFromTime(event.startTime);
		const end = getMinutesFromTime(event.endTime);
		let group = groups.find((candidate) => candidate.some((item) => getMinutesFromTime(item.endTime) > start && end > getMinutesFromTime(item.startTime)));
		if (!group) {
			group = [];
			groups.push(group);
		}
		group.push(event);
	});

	groups.forEach((group) => {
		group.forEach((event, index) => {
			const start = getMinutesFromTime(event.startTime);
			const end = getMinutesFromTime(event.endTime);
			const element = createHomeScheduleEvent(event, false);
			element.style.top = `${(start - 420) * 0.9}px`;
			element.style.height = `${Math.max((end - start) * 0.9, 30)}px`;
			element.style.left = `calc(30px + ${(index / group.length) * 100}% - ${(index / group.length) * 30}px)`;
			element.style.width = `calc(${100 / group.length}% - ${(30 / group.length) + 2}px)`;
			timeline.appendChild(element);
		});
	});
}

function getMinutesFromTime(value) {
	const parts = String(value).split(':').map(Number);
	return parts[0] * 60 + parts[1];
}

function renderNoticeText(text) {
	const wrapper = document.createElement('div');
	wrapper.className = 'notice-body';
	const parts = String(text ?? '').split(/\[\[(.*?)\]\]/g);
	parts.forEach((part, index) => {
		if (index % 2 === 1) {
			const highlight = document.createElement('span');
			highlight.className = 'highlight';
			highlight.textContent = part;
			wrapper.appendChild(highlight);
			return;
		}
		if (part) {
			wrapper.appendChild(document.createTextNode(part));
		}
	});
	return wrapper;
}

async function fetchNotices() {
	const container = document.getElementById('notice-container');
	try {
		const res = await callGasApi('getNotice');
		if (!res.success || !res.notices || res.notices.length === 0) {
			container.textContent = '';
			const empty = document.createElement('div');
			empty.className = 'notice-message';
			empty.textContent = '現在お知らせはありません。';
			container.appendChild(empty);
			return;
		}

		container.textContent = '';
		res.notices.forEach((item) => {
			const notice = document.createElement('div');
			notice.className = `notice-item${item.isPinned ? ' is-pinned' : ''}`;
			const header = document.createElement('div');
			header.className = 'notice-header';
			if (item.isPinned) {
				const pinTag = document.createElement('span');
				pinTag.className = 'notice-pin-tag';
				pinTag.textContent = '[固定]';
				header.appendChild(pinTag);
			}
			const time = document.createElement('span');
			time.textContent = String(item.time ?? '').replace(/:\d{2}$/, '');
			header.appendChild(time);
			const body = renderNoticeText(item.text);
			notice.appendChild(header);
			notice.appendChild(body);
			container.appendChild(notice);
		});
	} catch (e) {
		container.textContent = '';
		const error = document.createElement('div');
		error.className = 'notice-message notice-message-error';
		error.textContent = 'お知らせの取得に失敗しました。GASのURLをご確認ください。';
		container.appendChild(error);
	}
}
