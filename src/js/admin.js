initCommonLayout('admin');

document.addEventListener('DOMContentLoaded', () => {
	const isAdmin = checkAdminLogin();
	if (isAdmin) {
		showDashboard();
	} else {
		document.getElementById('admin-login-section').style.display = 'block';
	}
});

async function handleAdminLogin() {
	const username = document.getElementById('admin-username').value.trim();
	const password = document.getElementById('admin-password').value.trim();
	const btn = document.getElementById('btn-admin-login');

	await withButtonLoading(btn, async () => {
		const res = await callGasApi('verifyAdminLogin', { username, password });
		if (res.success) {
			setAdminLogin(true);
			showToast('管理者としてログインしました');
			showDashboard();
		} else {
			showToast(res.error || '認証に失敗しました', 'error');
		}
	}, '認証中...');
}

function showDashboard() {
	document.getElementById('admin-login-section').style.display = 'none';
	document.getElementById('admin-dashboard-section').style.display = 'flex';
	loadDashboardData();
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

function insertHighlightTag() {
	const textarea = document.getElementById('notice-text');
	const start = textarea.selectionStart;
	const end = textarea.selectionEnd;
	const selected = textarea.value.substring(start, end);
	if (!selected) {
		showToast('強調したい文字を選択してください');
		return;
	}
	textarea.setRangeText(`[[${selected}]]`, start, end, 'end');
}

async function handleAddNotice() {
	const text = document.getElementById('notice-text').value.trim();
	const isPinned = document.getElementById('notice-is-pinned').checked;
	const btn = document.getElementById('btn-submit-notice');

	await withButtonLoading(btn, async () => {
		const res = await callGasApi('updateNotice', { text, isPinned });
		if (res.success) {
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
			const deleteBtn = document.createElement('button');
			deleteBtn.type = 'button';
			deleteBtn.className = 'btn btn-danger small-action-button';
			deleteBtn.textContent = '削除';
			deleteBtn.addEventListener('click', () => handleDeleteNotice(item.time, deleteBtn));

			actions.appendChild(toggleBtn);
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
			showToast('削除しました');
			fetchAdminNotices();
		} else {
			showToast(res.error || '失敗しました', 'error');
		}
	}, '削除中');
}

async function fetchLogs() {
	const tbody = document.getElementById('log-table-body');
	try {
		const res = await callGasApi('getLogs');
		if (!res.success || !res.logs || res.logs.length === 0) {
			tbody.textContent = '';
			const row = document.createElement('tr');
			const cell = document.createElement('td');
			cell.colSpan = 7;
			cell.className = 'table-message';
			cell.textContent = 'ログはありません';
			row.appendChild(cell);
			tbody.appendChild(row);
			return;
		}

		tbody.textContent = '';
		res.logs.forEach((rowData) => {
			const row = document.createElement('tr');
			for (let i = 0; i < 7; i += 1) {
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
		cell.colSpan = 7;
		cell.className = 'table-message table-message-error';
		cell.textContent = '取得失敗';
		row.appendChild(cell);
		tbody.appendChild(row);
	}
}
