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
			container.innerHTML = '<div class="table-message">お知らせはありません</div>';
			return;
		}

		container.innerHTML = res.notices.map(item => `
			<div class="admin-notice-item">
				<div class="admin-notice-text">
					<span class="admin-notice-time">${escapeHtml(item.time)}</span>
					${escapeHtml(item.text)}
				</div>
				<div class="admin-notice-actions">
					<button type="button" class="btn btn-primary small-action-button" onclick="handleTogglePin('${escapeHtml(item.time)}', this)">
						${item.isPinned ? '解除' : '固定'}
					</button>
					<button type="button" class="btn btn-danger small-action-button" onclick="handleDeleteNotice('${escapeHtml(item.time)}', this)">
						削除
					</button>
				</div>
			</div>
		`).join('');
	} catch(e) {
		container.innerHTML = '<div class="table-message table-message-error">取得失敗</div>';
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
			tbody.innerHTML = '<tr><td colspan="7" class="table-message">ログはありません</td></tr>';
			return;
		}

		tbody.innerHTML = res.logs.map(row => `
			<tr>
				<td>${escapeHtml(row[0])}</td>
				<td>${escapeHtml(row)}</td>
				<td>${escapeHtml(row)}</td>
				<td>${escapeHtml(row[3])}</td>
				<td>${escapeHtml(row[4])}</td>
				<td>${escapeHtml(row[5])}</td>
				<td>${escapeHtml(row[6])}</td>
			</tr>
		`).join('');
	} catch(e) {
		tbody.innerHTML = '<tr><td colspan="7" class="table-message table-message-error">取得失敗</td></tr>';
	}
}
