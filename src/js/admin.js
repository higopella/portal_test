initCommonLayout('admin');

document.addEventListener('DOMContentLoaded', async () => {
	showChecking();
	bindAdminFormEvents();
	if (!await requirePageAuthentication()) return;
	if (checkAdminLogin()) {
		showDashboard();
	} else {
		showAccessDenied();
	}
});

function bindAdminFormEvents() {
	document.getElementById('form-add-notice').addEventListener('submit', (e) => {
		e.preventDefault();
		handleAddNotice();
	});
	document.getElementById('btn-insert-highlight').addEventListener('click', () => wrapNoticeSelection('[[', ']]'));
	document.getElementById('btn-insert-strike').addEventListener('click', () => wrapNoticeSelection('~~', '~~'));
	document.getElementById('btn-cancel-edit').addEventListener('click', cancelEditNotice);
	document.getElementById('btn-refresh-all').addEventListener('click', loadDashboardData);
	document.getElementById('form-main-event').addEventListener('submit', (e) => {
		e.preventDefault();
		handleAddMainEvent();
	});
	document.getElementById('main-event-all-day').addEventListener('change', (e) => {
		document.getElementById('main-event-time-row').classList.toggle('is-hidden', e.target.checked);
	});
	document.querySelectorAll('.admin-tab').forEach((tab) => {
		tab.addEventListener('click', () => switchAdminTab(tab.dataset.tab));
	});
}

function switchAdminTab(tabKey) {
	document.querySelectorAll('.admin-tab').forEach((tab) => {
		tab.classList.toggle('active', tab.dataset.tab === tabKey);
	});
	document.querySelectorAll('.admin-tab-panel').forEach((panel) => {
		panel.classList.toggle('is-hidden', panel.id !== `tab-${tabKey}`);
	});
}

function showChecking() {
	document.getElementById('admin-checking-section').style.display = 'flex';
	document.getElementById('admin-access-denied-section').style.display = 'none';
	document.getElementById('admin-dashboard-section').style.display = 'none';
}

function showDashboard() {
	document.getElementById('admin-checking-section').style.display = 'none';
	document.getElementById('admin-access-denied-section').style.display = 'none';
	document.getElementById('admin-dashboard-section').style.display = 'flex';
	loadDashboardData();
}

function showAccessDenied() {
	document.getElementById('admin-checking-section').style.display = 'none';
	document.getElementById('admin-access-denied-section').style.display = 'block';
	document.getElementById('admin-dashboard-section').style.display = 'none';
}

async function loadDashboardData() {
	const refreshBtn = document.getElementById('btn-refresh-all');
	await withButtonLoading(refreshBtn, async () => {
		await Promise.all([fetchAccessCount(), fetchAdminNotices(), fetchLogs()]);
	}, '更新中');
}

async function fetchAccessCount() {
	try {
		const res = await callGasApi('getAccessCount');
		if (res.success) {
			document.getElementById('stat-access-count').textContent = Number(res.count).toLocaleString();
		}
	} catch(e) {}
}

function wrapNoticeSelection(before, after) {
	const textarea = document.getElementById('notice-text');
	const start = textarea.selectionStart;
	const end = textarea.selectionEnd;
	const selected = textarea.value.substring(start, end);
	if (!selected) {
		showToast('装飾したい文字を選択してください');
		return;
	}
	textarea.setRangeText(`${before}${selected}${after}`, start, end, 'end');
	textarea.focus();
}

let editingNoticeTime = null;

function startEditNotice(item) {
	editingNoticeTime = item.time;
	document.getElementById('notice-text').value = item.text;
	document.getElementById('notice-is-pinned').checked = !!item.isPinned;
	document.getElementById('btn-submit-notice').textContent = '更新';
	document.getElementById('btn-cancel-edit').classList.remove('is-hidden');
	document.getElementById('notice-text').focus();
	window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEditNotice() {
	editingNoticeTime = null;
	document.getElementById('form-add-notice').reset();
	document.getElementById('btn-submit-notice').textContent = '追加';
	document.getElementById('btn-cancel-edit').classList.add('is-hidden');
}

async function handleAddNotice() {
	const text = document.getElementById('notice-text').value.trim();
	const isPinned = document.getElementById('notice-is-pinned').checked;
	const btn = document.getElementById('btn-submit-notice');

	if (editingNoticeTime) {
		await withButtonLoading(btn, async () => {
			const res = await callGasApi('editNotice', { time: editingNoticeTime, text });
			if (res.success) {
				await clearNoticeDeviceCache();
				showToast('お知らせを更新しました');
				cancelEditNotice();
				fetchAdminNotices();
			} else {
				showToast(res.error || '更新に失敗しました', 'error');
			}
		}, '更新中...');
		return;
	}

	await withButtonLoading(btn, async () => {
		const res = await callGasApi('updateNotice', { text, isPinned });
		if (res.success) {
			await clearNoticeDeviceCache();
			showToast('お知らせを追加しました');
			document.getElementById('form-add-notice').reset();
			fetchAdminNotices();
		} else {
			showToast(res.error || '追加に失敗しました', 'error');
		}
	}, '追加中...');
}

async function fetchAdminNotices() {
	const container = document.getElementById('admin-notice-list');
	try {
		const res = await callGasApi('getNotice');
		if (!res.success || !res.notices || res.notices.length === 0) {
			container.textContent = '';
			const empty = document.createElement('div');
			empty.className = 'table-message';
			empty.textContent = 'お知らせはありません';
			container.appendChild(empty);
			return;
		}

		container.textContent = '';
		res.notices.forEach((item) => {
			const noticeItem = document.createElement('div');
			noticeItem.className = 'admin-notice-item';

			const noticeText = document.createElement('div');
			noticeText.className = 'admin-notice-text';
			const time = document.createElement('span');
			time.className = 'admin-notice-time';
			time.textContent = item.time;
			const body = document.createElement('div');
			body.textContent = item.text;
			noticeText.appendChild(time);
			noticeText.appendChild(body);

			const actions = document.createElement('div');
			actions.className = 'admin-notice-actions';
			const toggleBtn = document.createElement('button');
			toggleBtn.type = 'button';
			toggleBtn.className = 'btn btn-primary small-action-button';
			toggleBtn.textContent = item.isPinned ? '解除' : '固定';
			toggleBtn.addEventListener('click', () => handleTogglePin(item.time, toggleBtn));
			const editBtn = document.createElement('button');
			editBtn.type = 'button';
			editBtn.className = 'btn btn-primary small-action-button';
			editBtn.textContent = '編集';
			editBtn.addEventListener('click', () => startEditNotice(item));
			const deleteBtn = document.createElement('button');
			deleteBtn.type = 'button';
			deleteBtn.className = 'btn btn-danger small-action-button';
			deleteBtn.textContent = '削除';
			deleteBtn.addEventListener('click', () => handleDeleteNotice(item.time, deleteBtn));

			actions.appendChild(toggleBtn);
			actions.appendChild(editBtn);
			actions.appendChild(deleteBtn);
			noticeItem.appendChild(noticeText);
			noticeItem.appendChild(actions);
			container.appendChild(noticeItem);
		});
	} catch(e) {
		container.textContent = '';
		const error = document.createElement('div');
		error.className = 'table-message table-message-error';
		error.textContent = '取得失敗';
		container.appendChild(error);
	}
}

async function handleTogglePin(timeStr, btn) {
	await withButtonLoading(btn, async () => {
		const res = await callGasApi('toggleNoticePin', { time: timeStr });
		if (res.success) {
			await clearNoticeDeviceCache();
			showToast('固定状態を切り替えました');
			fetchAdminNotices();
		} else {
			showToast(res.error || '失敗しました', 'error');
		}
	}, '処理中');
}

async function handleDeleteNotice(timeStr, btn) {
	if (!confirm('このお知らせを削除しますか？')) return;
	await withButtonLoading(btn, async () => {
		const res = await callGasApi('deleteNotice', { time: timeStr });
		if (res.success) {
			await clearNoticeDeviceCache();
			showToast('削除しました');
			fetchAdminNotices();
		} else {
			showToast(res.error || '失敗しました', 'error');
		}
	}, '削除中');
}

async function handleAddMainEvent() {
	const date = document.getElementById('main-event-date').value;
	const isAllDay = document.getElementById('main-event-all-day').checked;
	const startTime = document.getElementById('main-event-start').value;
	const endTime = document.getElementById('main-event-end').value;
	const title = document.getElementById('main-event-title').value.trim();
	const repName = document.getElementById('main-event-rep-name').value.trim();
	if (!date || !title || (!isAllDay && (!startTime || !endTime))) {
		showToast('未入力の項目があります', 'error');
		return;
	}
	const btn = document.getElementById('btn-submit-main-event');
	await withButtonLoading(btn, async () => {
		const res = await callGasApi('addMainEvent', { date, isAllDay, startTime, endTime, title, repName });
		if (res.success) {
			if (typeof clearScheduleDeviceCache === 'function') await clearScheduleDeviceCache();
			showToast('メインカレンダーに登録しました');
			document.getElementById('form-main-event').reset();
			fetchLogs();
		} else {
			showToast(res.error || '登録に失敗しました', 'error');
		}
	}, '登録中...');
}

async function fetchLogs() {
	const tbody = document.getElementById('log-table-body');
	try {
		const res = await callGasApi('getLogs');
		if (!res.success || !res.logs || res.logs.length === 0) {
			tbody.textContent = '';
			const row = document.createElement('tr');
			const cell = document.createElement('td');
			cell.colSpan = 8;
			cell.className = 'table-message';
			cell.textContent = 'ログはありません';
			row.appendChild(cell);
			tbody.appendChild(row);
			return;
		}

		tbody.textContent = '';
		res.logs.forEach((rowData) => {
			const row = document.createElement('tr');
			for (let i = 0; i < 8; i += 1) {
				const cell = document.createElement('td');
				cell.textContent = rowData[i] ?? '';
				row.appendChild(cell);
			}
			tbody.appendChild(row);
		});
	} catch(e) {
		tbody.textContent = '';
		const row = document.createElement('tr');
		const cell = document.createElement('td');
		cell.colSpan = 8;
		cell.className = 'table-message table-message-error';
		cell.textContent = '取得失敗';
		row.appendChild(cell);
		tbody.appendChild(row);
	}
}
