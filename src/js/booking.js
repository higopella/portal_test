initCommonLayout('booking');

document.addEventListener('DOMContentLoaded', () => {
	const today = new Date().toISOString().split('T')[0];
	document.getElementById('book-date').value = today;
	updateEndTimePreview();
});

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
		resultsContainer.innerHTML = '<div class="search-message">検索中...</div>';
		const res = await callGasApi('findEvents', { date, bandName });
    
		if (!res.success || !res.events || res.events.length === 0) {
			resultsContainer.innerHTML = '<div class="search-message">該当する予約が見つかりません</div>';
			return;
		}

		resultsContainer.innerHTML = res.events.map(ev => `
			<div class="event-card">
				<div>
					<div class="event-title">${escapeHtml(ev.title)}</div>
					<div class="event-time">${escapeHtml(ev.startStr)} (${escapeHtml(ev.duration)}分)</div>
				</div>
				<button type="button" class="btn btn-danger delete-booking-button" onclick="handleDeleteBooking('${escapeHtml(ev.id)}', this)">削除</button>
			</div>
		`).join('');
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
