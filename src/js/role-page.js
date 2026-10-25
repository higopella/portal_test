const ROLE_PAGE_KEY = (document.body.dataset.roleKey || 'admin');
const REQUIRED_ROLE = (document.body.dataset.requiredRole || ROLE_PAGE_KEY);

initCommonLayout(`role-${ROLE_PAGE_KEY}`);

const ROLE_SWITCH_PAGES = [
	{ role: 'admin', label: '管理者', href: '../admin/' },
	{ role: 'kanbu', label: '幹部', href: '../kanbu/' },
	{ role: 'higopelive', label: 'ヒゴペライブ', href: '../higopelive/' }
];

document.addEventListener('DOMContentLoaded', async () => {
	showChecking();
	bindRolePageEvents();
	if (!await requirePageAuthentication()) return;
	if (hasRole(REQUIRED_ROLE)) {
		showDashboard();
	} else {
		showAccessDenied();
	}
});

function bindRolePageEvents() {
	const on = (id, event, handler) => {
		const el = document.getElementById(id);
		if (el) el.addEventListener(event, handler);
	};
	on('form-add-notice', 'submit', (e) => {
		e.preventDefault();
		handleAddNotice();
	});
	on('btn-insert-highlight', 'click', () => wrapNoticeSelection('[[', ']]'));
	on('btn-insert-strike', 'click', () => wrapNoticeSelection('~~', '~~'));
	on('btn-cancel-edit', 'click', cancelEditNotice);
	on('btn-refresh-all', 'click', loadDashboardData);
	on('form-main-event', 'submit', (e) => {
		e.preventDefault();
		handleAddMainEvent();
	});
	on('main-event-all-day', 'change', (e) => {
		document.getElementById('main-event-time-row').classList.toggle('is-hidden', e.target.checked);
	});
	on('btn-admin-search-events', 'click', handleAdminSearchEvents);
	document.querySelectorAll('.admin-tab').forEach((tab) => {
		tab.addEventListener('click', () => switchAdminTab(tab.dataset.tab));
	});
	const deleteDate = document.getElementById('admin-delete-date');
	if (deleteDate) deleteDate.value = getScheduleDateString(new Date());
}

function renderRoleSwitcher() {
	const container = document.getElementById('role-switcher');
	if (!container || typeof hasRole !== 'function') return;
	const available = ROLE_SWITCH_PAGES.filter((page) => hasRole(page.role));
	if (available.length < 2) return;
	available.forEach((page) => {
		const link = document.createElement('a');
		link.className = 'role-switch-link' + (page.role === REQUIRED_ROLE ? ' current' : '');
		link.href = page.href;
		link.textContent = page.label;
		container.appendChild(link);
	});
	container.classList.remove('is-hidden');
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
	renderRoleSwitcher();
	loadDashboardData();
}

function showAccessDenied() {
	document.getElementById('admin-checking-section').style.display = 'none';
	document.getElementById('admin-access-denied-section').style.display = 'block';
	document.getElementById('admin-dashboard-section').style.display = 'none';
}

async function loadDashboardData() {
	const refreshBtn = document.getElementById('btn-refresh-all');
	const tasks = [];
	if (document.getElementById('stat-access-count')) tasks.push(fetchAccessCount());
	if (document.getElementById('admin-notice-list')) tasks.push(fetchAdminNotices());
	if (document.getElementById('log-table-body')) tasks.push(fetchLogs());
	if (document.getElementById('kanbu-user-list')) tasks.push(fetchUsers());
	if (refreshBtn) {
		await withButtonLoading(refreshBtn, async () => {
			await Promise.all(tasks);
		}, '更新中');
	} else {
		await Promise.all(tasks);
	}
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
	if (!container) return;
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

async function handleAdminSearchEvents() {
	const date = document.getElementById('admin-delete-date').value;
	if (!date) {
		showToast('対象日を選択してください', 'error');
		return;
	}
	const container = document.getElementById('admin-event-list');
	container.textContent = '読み込み中...';
	try {
		const res = await callGasApi('adminFindEvents', { date });
		container.textContent = '';
		if (!res.success || !res.events || res.events.length === 0) {
			const empty = document.createElement('div');
			empty.className = 'table-message';
			empty.textContent = '予定はありません';
			container.appendChild(empty);
			return;
		}
		res.events.forEach((event) => {
			const item = document.createElement('div');
			item.className = 'admin-notice-item';

			const text = document.createElement('div');
			text.className = 'admin-notice-text';
			const timeLabel = event.isAllDay ? '終日' : `${event.startTime}-${event.endTime}`;
			text.textContent = `${timeLabel} ${event.room} ${event.title}`;

			const actions = document.createElement('div');
			actions.className = 'admin-notice-actions';
			const deleteBtn = document.createElement('button');
			deleteBtn.type = 'button';
			deleteBtn.className = 'btn btn-danger small-action-button';
			deleteBtn.textContent = '削除';
			deleteBtn.addEventListener('click', () => handleAdminDeleteEvent(event.id, event.title, deleteBtn));
			actions.appendChild(deleteBtn);

			item.appendChild(text);
			item.appendChild(actions);
			container.appendChild(item);
		});
	} catch (e) {
		container.textContent = '';
		const error = document.createElement('div');
		error.className = 'table-message table-message-error';
		error.textContent = '取得失敗';
		container.appendChild(error);
	}
}

async function handleAdminDeleteEvent(eventId, title, btn) {
	if (!confirm(`「${title}」を削除しますか？`)) return;
	await withButtonLoading(btn, async () => {
		const res = await callGasApi('adminDeleteEvent', { eventId });
		if (res.success) {
			if (typeof clearScheduleDeviceCache === 'function') await clearScheduleDeviceCache();
			showToast('削除しました');
			handleAdminSearchEvents();
			fetchLogs();
		} else {
			showToast(res.error || '削除に失敗しました', 'error');
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
	if (!tbody) return;
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
const USERS_PER_PAGE = 100;
let allUsersCache = [];
let userListPage = 0;

async function fetchUsers() {
	const container = document.getElementById('kanbu-user-list');
	if (!container) return;
	try {
		const res = await callGasApi('listUsers');
		allUsersCache = (res.success && Array.isArray(res.users)) ? res.users : [];
		renderUserListPage(container, 0);
	} catch (e) {
		container.textContent = '';
		const error = document.createElement('div');
		error.className = 'table-message table-message-error';
		error.textContent = '取得失敗';
		container.appendChild(error);
	}
}

function renderUserListPage(container, page) {
	container.textContent = '';
	if (allUsersCache.length === 0) {
		const empty = document.createElement('div');
		empty.className = 'table-message';
		empty.textContent = 'ユーザーがいません';
		container.appendChild(empty);
		return;
	}
	const totalPages = Math.ceil(allUsersCache.length / USERS_PER_PAGE);
	userListPage = Math.max(0, Math.min(page, totalPages - 1));
	const start = userListPage * USERS_PER_PAGE;
	allUsersCache.slice(start, start + USERS_PER_PAGE).forEach((user) => container.appendChild(createUserRow(user)));

	if (totalPages > 1) {
		const pager = document.createElement('div');
		pager.className = 'user-pager';
		const prevBtn = document.createElement('button');
		prevBtn.type = 'button';
		prevBtn.className = 'btn small-action-button';
		prevBtn.textContent = '前へ';
		prevBtn.disabled = userListPage === 0;
		prevBtn.addEventListener('click', () => renderUserListPage(container, userListPage - 1));
		const info = document.createElement('span');
		info.className = 'user-pager-info';
		info.textContent = `${userListPage + 1} / ${totalPages} ページ（全${allUsersCache.length}人）`;
		const nextBtn = document.createElement('button');
		nextBtn.type = 'button';
		nextBtn.className = 'btn small-action-button';
		nextBtn.textContent = '次へ';
		nextBtn.disabled = userListPage >= totalPages - 1;
		nextBtn.addEventListener('click', () => renderUserListPage(container, userListPage + 1));
		pager.appendChild(prevBtn);
		pager.appendChild(info);
		pager.appendChild(nextBtn);
		container.appendChild(pager);
	}
}

const ROLE_SELECT_OPTIONS = ['user', 'higopelive', 'kanbu'];
const ROLE_SORT_ORDER = { user: 0, higopelive: 1, kanbu: 2 };

function createUserRow(user) {
	const item = document.createElement('div');
	item.className = 'admin-notice-item user-item';

	const info = document.createElement('div');
	info.className = 'admin-notice-text';
	const name = document.createElement('div');
	name.className = 'user-item-name';
	name.textContent = `${user.internalUserId} ${user.nickname}`;
	const email = document.createElement('div');
	email.className = 'user-item-email';
	email.textContent = user.schoolEmail;
	info.appendChild(name);
	info.appendChild(email);
	item.appendChild(info);

	const roleArea = document.createElement('div');
	roleArea.className = 'user-role-area';

	if (user.roles.indexOf('admin') !== -1) {
		const badge = document.createElement('span');
		badge.className = 'user-admin-badge';
		badge.textContent = 'admin';
		roleArea.appendChild(badge);
		item.appendChild(roleArea);
		return item;
	}

	const selectWrap = document.createElement('div');
	selectWrap.className = 'user-role-selects';
	const editableRoles = user.roles
		.filter((role) => role !== 'user' && role !== 'admin')
		.sort((a, b) => ROLE_SORT_ORDER[a] - ROLE_SORT_ORDER[b]);
	(editableRoles.length > 0 ? editableRoles : ['user']).forEach((role) => {
		selectWrap.appendChild(createRoleSelect(role));
	});
	roleArea.appendChild(selectWrap);

	const actions = document.createElement('div');
	actions.className = 'admin-notice-actions user-role-actions';
	const addBtn = document.createElement('button');
	addBtn.type = 'button';
	addBtn.className = 'btn small-action-button';
	addBtn.textContent = '＋';
	addBtn.title = 'ロールを追加';
	addBtn.addEventListener('click', () => selectWrap.appendChild(createRoleSelect('user')));
	const saveBtn = document.createElement('button');
	saveBtn.type = 'button';
	saveBtn.className = 'btn btn-primary small-action-button';
	saveBtn.textContent = '保存';
	saveBtn.addEventListener('click', () => handleSaveUserRoles(user.internalUserId, selectWrap, saveBtn));
	actions.appendChild(addBtn);
	actions.appendChild(saveBtn);
	roleArea.appendChild(actions);

	item.appendChild(roleArea);
	return item;
}

function createRoleSelect(value) {
	const select = document.createElement('select');
	select.className = 'input-text user-role-select';
	select.setAttribute('aria-label', 'ロール');
	ROLE_SELECT_OPTIONS.forEach((role) => {
		const option = document.createElement('option');
		option.value = role;
		option.textContent = role;
		select.appendChild(option);
	});
	select.value = value;
	return select;
}

async function handleSaveUserRoles(internalUserId, selectWrap, btn) {
	const picked = [];
	selectWrap.querySelectorAll('select').forEach((select) => {
		if (select.value !== 'user' && picked.indexOf(select.value) === -1) picked.push(select.value);
	});
	const roles = picked.length > 0 ? picked : ['user'];
	await withButtonLoading(btn, async () => {
		const res = await callGasApi('updateUserRoles', { internalUserId, roles });
		if (res.success) {
			showToast('ロールを更新しました');
			fetchUsers();
		} else {
			showToast(res.error || '更新に失敗しました', 'error');
		}
	}, '保存中');
}