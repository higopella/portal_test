initCommonLayout('booking');

document.addEventListener('DOMContentLoaded', async () => {
	initPageTour('booking');
	await loadEnabledRooms();
	applyEnabledRoomsToForm();
	let resolveAuthentication;
	const authenticationReady = new Promise((resolve) => {
		resolveAuthentication = resolve;
	});
	const calendarReady = initializeBookingScheduleCalendar(authenticationReady);
	const isAuthenticated = await requirePageAuthentication();
	resolveAuthentication(isAuthenticated);
	if (!isAuthenticated) return;
	document.getElementById('tab-btn-create').addEventListener('click', () => switchTab('create'));
	document.getElementById('tab-btn-search').addEventListener('click', () => switchTab('search'));
	document.getElementById('form-booking').addEventListener('submit', (event) => { event.preventDefault(); handleAddBooking(); });
	document.getElementById('btn-cancel-edit').addEventListener('click', exitEditBooking);
	document.getElementById('form-search').addEventListener('submit', (event) => { event.preventDefault(); handleSearch(); });
	document.getElementById('book-start-time').addEventListener('change', updateEndTimePreview);
	document.getElementById('book-duration').addEventListener('change', updateEndTimePreview);
	document.getElementById('book-start-time').addEventListener('input', validateBookingInputs);
	document.getElementById('book-duration').addEventListener('input', validateBookingInputs);
	document.getElementById('book-room').addEventListener('change', validateBookingInputs);
	document.getElementById('book-date').addEventListener('change', loadAvailableTimeSlots);
	document.getElementById('book-date').addEventListener('change', validateBookingInputs);
	document.querySelectorAll('[data-duration]').forEach((button) => {
		button.addEventListener('click', () => {
			document.getElementById('book-duration').value = button.dataset.duration;
			updateEndTimePreview();
			validateBookingInputs();
		});
	});
	updateEndTimePreview();
	await calendarReady;
});

const ALL_ROOMS = ['①', '②', '③'];

async function loadEnabledRooms() {
	try {
		const res = await callGasApi('getEnabledRooms');
		window.enabledRooms = (res.success && Array.isArray(res.rooms) && res.rooms.length > 0) ? res.rooms : ALL_ROOMS;
	} catch (e) {
		window.enabledRooms = ALL_ROOMS;
	}
}

function applyEnabledRoomsToForm() {
	const select = document.getElementById('book-room');
	if (!select) return;
	const enabled = Array.isArray(window.enabledRooms) ? window.enabledRooms : ALL_ROOMS;
	Array.from(select.options).forEach((option) => {
		if (option.value && enabled.indexOf(option.value) === -1) option.remove();
	});
}

function getLocalDateString(date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

async function initializeBookingScheduleCalendar(authenticationReady) {
	const host = document.querySelector('[data-schedule-calendar]');
	bookingScheduleController = await initScheduleCalendar({
		host,
		loadEvents: async (start, end, forceRefresh) => {
			if (!await authenticationReady) throw new Error('認証が必要です');
			const result = await callGasApi('getScheduleEvents', {
				startDate: getLocalDateString(start),
				endDate: getLocalDateString(end),
				forceRefresh
			});
			if (!result.success) throw new Error(result.error || '予定の取得に失敗しました');
			return { events: result.events, revision: result.revision };
		},
		createEventElement: createScheduleEventElement
	});
	host.querySelector('.schedule-booking-link')?.addEventListener('click', (event) => {
		event.preventDefault();
		switchTab('create');
		const panel = document.getElementById('panel-create');
		const tabNav = document.querySelector('.booking-form-card .tab-nav');
		const target = window.matchMedia('(max-width: 760px)').matches && tabNav ? tabNav : panel;
		const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height'), 10) || 0;
		const targetTop = target.getBoundingClientRect().top + window.scrollY - headerHeight - 8;
		window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
	});
}

function createScheduleEventElement(event, isAllDay) {
	const eventElement = document.createElement('div');
	eventElement.className = `schedule-event ${getScheduleRoomClass(event.room)}${isAllDay ? ' schedule-event-all-day' : ''}`;
	const title = document.createElement('span');
	title.className = 'schedule-event-title';
	title.textContent = event.title;
	eventElement.appendChild(title);
	if (event.transferStatus) {
		const transfer = document.createElement('span');
		transfer.className = 'schedule-event-transfer';
		transfer.textContent = event.transferStatus;
		eventElement.appendChild(transfer);
	}
	const editable = event.id && !event.adminBooking && !event.isAllDay && ALL_ROOMS.indexOf(event.room) !== -1;
	eventElement.addEventListener('click', () => {
		const options = {};
		if (editable) {
			options.onEdit = startEditBooking;
			if (new Date(String(event.end).replace(/-/g, '/').replace('T', ' ')) > new Date()) options.onTransfer = showTransferForm;
			if (event.transferReceived) options.onCancelTransfer = (target) => handleCancelTransfer(target.id);
		}
		showScheduleEventDetail(event, options);
	});
	return eventElement;
}

function buildTransferSegments(event, transferStart, transferEnd, receiverName) {
	const start = getTimeMinutes(event.startTime);
	const end = getTimeMinutes(event.endTime);
	const segments = [];
	if (transferStart > start) segments.push({ from: start, to: transferStart, label: `${event.title}（譲りました）`, isReceiver: false });
	segments.push({ from: transferStart, to: transferEnd, label: `${receiverName || '譲る相手'}（譲られました）`, isReceiver: true });
	if (transferEnd < end) segments.push({ from: transferEnd, to: end, label: `${event.title}（譲りました）`, isReceiver: false });
	return segments;
}

function showTransferForm(event) {
	const start = getTimeMinutes(event.startTime);
	const end = getTimeMinutes(event.endTime);
	const middle = start + Math.floor((end - start) / 2);
	const body = document.createElement('div');
	body.className = 'transfer-form';

	const summary = document.createElement('p');
	summary.className = 'transfer-summary';
	summary.textContent = `予約: ${event.startTime}-${event.endTime} ${event.title}${event.transferStatus ? `（${event.transferStatus}）` : ''}`;

	const presets = document.createElement('div');
	presets.className = 'duration-presets';
	const timeRow = document.createElement('div');
	timeRow.className = 'transfer-time-row';
	const createTimeInput = (label, value) => {
		const wrap = document.createElement('label');
		wrap.className = 'transfer-time-label';
		wrap.textContent = label;
		const input = document.createElement('input');
		input.type = 'time';
		input.step = '60';
		input.min = event.startTime;
		input.max = event.endTime;
		input.className = 'form-control';
		input.value = formatTimeMinutes(value);
		wrap.appendChild(input);
		timeRow.appendChild(wrap);
		return input;
	};
	const isSecondHalf = event.transferStatus === '後半';
	const fromInput = createTimeInput('譲る開始', isSecondHalf ? middle : start);
	const toInput = createTimeInput('譲る終了', isSecondHalf ? end : middle);
	[['前半', start, middle], ['後半', middle, end]].forEach(([label, from, to]) => {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'duration-preset';
		button.textContent = label;
		button.addEventListener('click', () => {
			fromInput.value = formatTimeMinutes(from);
			toInput.value = formatTimeMinutes(to);
			updatePreview();
		});
		presets.appendChild(button);
	});

	const bar = document.createElement('div');
	bar.className = 'transfer-bar';
	const createTextInput = (labelText, placeholder) => {
		const group = document.createElement('div');
		group.className = 'form-group';
		const label = document.createElement('label');
		label.className = 'form-label';
		label.textContent = labelText;
		const input = document.createElement('input');
		input.type = 'text';
		input.className = 'form-control';
		input.placeholder = placeholder;
		label.appendChild(input);
		group.appendChild(label);
		body.appendChild(group);
		return input;
	};
	const preview = document.createElement('div');
	preview.className = 'transfer-preview';
	const error = document.createElement('div');
	error.className = 'booking-form-error';
	error.hidden = true;

	body.append(summary, presets, timeRow, bar);
	const bandInput = createTextInput('譲る相手のバンド名', '例: バンドB');
	const repInput = createTextInput('譲る相手の代表者名', '例: 肥後');
	body.append(preview, error);

	const actions = document.createElement('div');
	actions.className = 'transfer-actions';
	const cancelBtn = document.createElement('button');
	cancelBtn.type = 'button';
	cancelBtn.className = 'btn';
	cancelBtn.textContent = 'キャンセル';
	cancelBtn.addEventListener('click', closeModal);
	const submitBtn = document.createElement('button');
	submitBtn.type = 'button';
	submitBtn.className = 'btn btn-primary';
	submitBtn.textContent = '譲る';
	actions.append(cancelBtn, submitBtn);
	body.appendChild(actions);

	const getRange = () => {
		if (!fromInput.value || !toInput.value) return null;
		const from = getTimeMinutes(fromInput.value);
		const to = getTimeMinutes(toInput.value);
		return from >= start && to <= end && from < to ? { from, to } : null;
	};
	function updatePreview() {
		const range = getRange();
		bar.textContent = '';
		preview.textContent = '';
		if (!range) {
			preview.textContent = `譲る時間は${event.startTime}〜${event.endTime}の範囲で、開始より後の終了時刻を指定してください`;
			return;
		}
		const segments = buildTransferSegments(event, range.from, range.to, bandInput.value.trim());
		segments.forEach((segment) => {
			const part = document.createElement('span');
			part.className = `transfer-bar-part${segment.isReceiver ? ' is-receiver' : ''}`;
			part.style.flexGrow = String(segment.to - segment.from);
			bar.appendChild(part);
		});
		preview.textContent = segments.map((segment) => `${formatTimeMinutes(segment.from)}-${formatTimeMinutes(segment.to)} ${segment.label}`).join('\n');
	}
	[fromInput, toInput, bandInput].forEach((input) => input.addEventListener('input', updatePreview));

	submitBtn.addEventListener('click', async () => {
		const range = getRange();
		const bandName = bandInput.value.trim();
		const repName = repInput.value.trim();
		const message = !range ? `譲る時間は${event.startTime}〜${event.endTime}の範囲で指定してください`
			: (!bandName || !repName) ? '譲る相手のバンド名と代表者名を入力してください' : '';
		error.textContent = message;
		error.hidden = !message;
		if (message) return;
		let transferred = false;
		await withButtonLoading(submitBtn, async () => {
			try {
				const res = await callGasApi('transferBooking', {
					eventId: event.id,
					transferStart: formatTimeMinutes(range.from),
					transferEnd: formatTimeMinutes(range.to),
					bandName,
					repName
				});
				if (res.success) {
					transferred = true;
				} else {
					error.textContent = res.error || '譲渡に失敗しました';
					error.hidden = false;
				}
			} catch (e) {
				error.textContent = '譲渡に失敗しました';
				error.hidden = false;
			}
		}, '処理中...');
		if (!transferred) return;
		closeModal();
		showToast('予約を譲渡しました');
		await clearScheduleDeviceCache();
		bookingScheduleController?.refresh(true);
	});

	showModal('予約を譲る', body);
	updatePreview();
}

let bookingScheduleController = null;
let editingBooking = null;

function getMinutesBetween(start, end) {
	return Math.round((new Date(end.replace(/-/g, '/').replace('T', ' ')) - new Date(start.replace(/-/g, '/').replace('T', ' '))) / 60000);
}

function startEditBooking(event) {
	const date = String(event.start).slice(0, 10);
	const duration = getMinutesBetween(event.start, event.end);
	editingBooking = { eventId: event.id, date, room: event.room, startTime: event.startTime, duration };
	switchTab('create');
	document.getElementById('book-date').value = date;
	document.getElementById('book-start-time').value = event.startTime;
	document.getElementById('book-duration').value = String(duration);
	const roomSelect = document.getElementById('book-room');
	if (!Array.from(roomSelect.options).some((option) => option.value === event.room)) {
		roomSelect.appendChild(new Option(SCHEDULE_ROOM_NAMES[event.room] || event.room, event.room));
	}
	roomSelect.value = event.room;
	document.getElementById('book-band-name').value = event.title || '';
	document.getElementById('book-rep-name').value = event.repName || '';
	const transferSelect = document.getElementById('book-transfer');
	transferSelect.value = Array.from(transferSelect.options).some((option) => option.value === event.transferStatus) ? event.transferStatus : '';
	document.getElementById('btn-submit-booking').textContent = '変更を保存';
	document.getElementById('btn-cancel-edit').hidden = false;
	document.getElementById('tab-btn-create').textContent = '予約の編集';
	showBookingError('');
	updateEndTimePreview();
	loadAvailableTimeSlots();
	document.getElementById('panel-create').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function exitEditBooking() {
	editingBooking = null;
	document.getElementById('form-booking').reset();
	applyEnabledRoomsToForm();
	document.getElementById('btn-submit-booking').textContent = '予約';
	document.getElementById('btn-cancel-edit').hidden = true;
	document.getElementById('tab-btn-create').textContent = '新規予約';
	document.getElementById('available-time-slots').hidden = true;
	showBookingError('');
	updateEndTimePreview();
}

function isEditScheduleUnchanged(date, room, startTime, duration) {
	return editingBooking && editingBooking.date === date && editingBooking.room === room &&
		editingBooking.startTime === startTime && editingBooking.duration === duration;
}

function getScheduleRoomClass(room) {
	if (room === '②') return 'schedule-event-equipment';
	if (room === '③') return 'schedule-event-classroom';
	if (room === 'メイン') return 'schedule-event-main';
	return 'schedule-event-clubroom';
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
	const durationVal = Number(document.getElementById('book-duration').value);
	const previewEl = document.getElementById('end-time-preview');

	if (!timeVal || !Number.isInteger(durationVal) || durationVal < 1) {
		previewEl.textContent = '開始時間と利用分数を入力してください';
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

function showBookingError(message) {
	let error = document.getElementById('booking-form-error');
	if (!error) {
		error = document.createElement('div');
		error.id = 'booking-form-error';
		error.className = 'booking-form-error';
		document.getElementById('form-booking').prepend(error);
	}
	error.textContent = message;
	error.hidden = !message;
}

function getBookingValidationError() {
	const date = document.getElementById('book-date').value;
	const startTime = document.getElementById('book-start-time').value;
	const duration = Number(document.getElementById('book-duration').value);
	if (date) {
		const selectedDate = new Date(`${date}T00:00:00`);
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		if (selectedDate < today) return '過去の日付は予約できません';
	}
	if (date && startTime) {
		const startDateTime = new Date(`${date.replace(/-/g, '/')} ${startTime}:00`);
		if (startDateTime <= new Date()) return '過去の日時は予約できません';
		const maxDate = new Date();
		maxDate.setMonth(maxDate.getMonth() + 1);
		maxDate.setHours(23, 59, 59, 999);
		if (startDateTime > maxDate) return '1ヶ月より先の予約はできません';
	}
	if (startTime && getTimeMinutes(startTime) < 7 * 60) return '開始時間は7:00以降にしてください';
	if (duration && (!Number.isInteger(duration) || duration < 1 || duration > 120)) return '利用分数は1〜120分で入力してください';
	if (startTime && Number.isInteger(duration)) {
		if (getTimeMinutes(startTime) + duration > 21 * 60) return '終了時間は21:00までにしてください';
		if (getTimeMinutes(startTime) >= 18 * 60 && duration > 90) return '18:00以降は最大90分までです';
	}
	return '';
}

function validateBookingInputs() {
	const hasInput = ['book-date', 'book-start-time', 'book-duration', 'book-room']
		.some((id) => document.getElementById(id).value);
	if (hasInput) showBookingError(getBookingValidationError());
}

function getTimeMinutes(value) {
	const [hours, minutes] = value.split(':').map(Number);
	return hours * 60 + minutes;
}

function formatTimeMinutes(minutes) {
	return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function buildAvailableSlots(events, room) {
	const occupied = events
		.filter((event) => event.room === room && !event.isAllDay)
		.map((event) => [getTimeMinutes(event.startTime), getTimeMinutes(event.endTime)])
		.sort((a, b) => a[0] - b[0]);
	const slots = [];
	let cursor = 7 * 60;
	occupied.forEach(([start, end]) => {
		if (start > cursor) slots.push([cursor, start]);
		cursor = Math.max(cursor, end);
	});
	if (cursor < 21 * 60) slots.push([cursor, 21 * 60]);
	return slots.map(([start, end]) => `${formatTimeMinutes(start)}〜${formatTimeMinutes(end)}`);
}

async function loadAvailableTimeSlots() {
	const date = document.getElementById('book-date').value;
	const container = document.getElementById('available-time-slots');
	if (!date) {
		container.hidden = true;
		container.textContent = '';
		return;
	}
	container.hidden = false;
	container.textContent = '空き時間を確認中...';
	try {
		const result = await callGasApi('getScheduleEvents', { startDate: date, endDate: date });
		if (!result.success) throw new Error(result.error);
		container.textContent = '';
		const roomLabels = { '①': '部室', '②': '機材庫', '③': '教室' };
		const enabled = Array.isArray(window.enabledRooms) ? window.enabledRooms : ['①', '②', '③'];
		const otherEvents = (result.events || []).filter((event) => !editingBooking || event.id !== editingBooking.eventId);
		enabled.forEach((room) => {
			const row = document.createElement('div');
			row.className = 'available-time-row';
			const label = document.createElement('span');
			label.textContent = roomLabels[room];
			const value = document.createElement('span');
			value.textContent = buildAvailableSlots(otherEvents, room).join('、') || '空きなし';
			row.append(label, value);
			container.appendChild(row);
		});
	} catch (error) {
		container.textContent = '空き時間を取得できませんでした';
	}
}

async function handleAddBooking() {
	const date = document.getElementById('book-date').value;
	const room = document.getElementById('book-room').value;
	const startTime = document.getElementById('book-start-time').value;
	const duration = Number(document.getElementById('book-duration').value);
	const bandName = document.getElementById('book-band-name').value.trim();
	const repName = document.getElementById('book-rep-name').value.trim();
	const transferStatus = document.getElementById('book-transfer').value;
	const btn = document.getElementById('btn-submit-booking');
	showBookingError('');
	if (!date || !startTime || !room || !bandName || !repName || !transferStatus || !Number.isInteger(duration)) {
		showBookingError('必須項目を入力してください');
		return;
	}
	if (duration < 1 || duration > 120) {
		showBookingError('利用分数は1〜120分で入力してください');
		return;
	}

	if (editingBooking) {
		if (!isEditScheduleUnchanged(date, room, startTime, duration)) {
			const scheduleError = getBookingValidationError();
			if (scheduleError) {
				showBookingError(scheduleError);
				return;
			}
		}
		const updateData = { eventId: editingBooking.eventId, date, room, startTime, duration, bandName, repName, transferStatus };
		let updated = false;
		await withButtonLoading(btn, async () => {
			const res = await callGasApi('updateBooking', updateData);
			if (res.success) {
				updated = true;
				await clearScheduleDeviceCache();
				showToast('予約を変更しました');
			} else {
				showBookingError(res.error || '変更に失敗しました');
			}
		}, '保存中...');
		if (updated) {
			exitEditBooking();
			bookingScheduleController?.refresh(true);
		}
		return;
	}

	const startDateTime = new Date(`${date.replace(/-/g, '/')} ${startTime}:00`);
	const now = new Date();
	if (startDateTime <= now) {
		showBookingError('過去の日時は予約できません');
		return;
	}

	const maxDate = new Date();
	maxDate.setMonth(maxDate.getMonth() + 1);
	maxDate.setHours(23, 59, 59, 999);
	if (startDateTime > maxDate) {
		showBookingError('1ヶ月より先の予約はできません');
		return;
	}

	const endDateTime = new Date(startDateTime.getTime() + duration * 60000);
	const limit18 = new Date(startDateTime);
	limit18.setHours(18, 0, 0, 0);
	if (endDateTime > limit18 && duration > 90) {
		showBookingError('18:00を超える予約は最大90分までです');
		return;
	}
	if (getTimeMinutes(startTime) < 7 * 60 || getTimeMinutes(startTime) + duration > 21 * 60) {
		showBookingError('予約は7:00〜21:00の範囲で入力してください');
		return;
	}

	const payloadData = { date, room, startTime, duration, bandName, repName, transferStatus };

	await withButtonLoading(btn, async () => {
		const res = await callGasApi('addEventToCalendar', payloadData);
		if (res.success) {
			await clearScheduleDeviceCache();
			showToast('予約が完了しました');
			document.getElementById('form-booking').reset();
			updateEndTimePreview();
			document.getElementById('available-time-slots').hidden = true;
		} else {
			showBookingError(res.error || '予約に失敗しました');
		}
	}, '予約中...');
}

async function handleSearch() {
	const date = document.getElementById('search-date').value;
	const bandName = document.getElementById('search-band-name').value.trim();
	const btn = document.getElementById('btn-search-booking');
	const resultsContainer = document.getElementById('search-results');

	await withButtonLoading(btn, async () => {
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
			deleteBtn.addEventListener('click', () => handleDeleteBooking(ev.id, deleteBtn, ev.transferReceived));
			info.appendChild(title);
			info.appendChild(time);
			card.appendChild(info);
			card.appendChild(deleteBtn);
			resultsContainer.appendChild(card);
		});
	}, '検索中...');
}

async function handleCancelTransfer(eventId, buttonEl) {
	if (!confirm('譲渡を取り消しますか？\n譲られた予約を削除し、元の予約が変更されていなければ時間を戻します。')) return false;
	let cancelled = false;
	const run = async () => {
		try {
			const res = await callGasApi('cancelTransfer', { eventId });
			if (!res.success) {
				showToast(res.error || '取り消しに失敗しました', 'error');
				return;
			}
			cancelled = true;
			showToast(res.restored ? '譲渡を取り消し、元の予約に時間を戻しました' : '譲渡を取り消しました（元の予約が変更・削除されていたため時間は戻していません）');
		} catch (e) {
			showToast('取り消しに失敗しました', 'error');
		}
	};
	if (buttonEl) await withButtonLoading(buttonEl, run, '処理中...');
	else await run();
	if (!cancelled) return false;
	closeModal();
	await clearScheduleDeviceCache();
	bookingScheduleController?.refresh(true);
	return true;
}

async function handleDeleteBooking(eventId, buttonEl, transferReceived) {
	if (transferReceived) {
		if (await handleCancelTransfer(eventId, buttonEl)) buttonEl.closest('.event-card')?.remove();
		return;
	}
	if (!confirm('本当にこの予約を削除しますか？')) return;

	await withButtonLoading(buttonEl, async () => {
		const res = await callGasApi('deleteEventById', { eventId });
		if (res.success) {
			await clearScheduleDeviceCache();
			showToast('予約を削除しました');
			const card = buttonEl.closest('.event-card');
			if (card) card.remove();
		} else {
			showToast(res.error || '削除に失敗しました', 'error');
		}
	}, '削除中...');
}
