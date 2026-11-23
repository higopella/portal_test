/**
 * 権限ページへの振り分け (src/js/role-select.js)
 */

const ROLE_PAGE_STORAGE_KEY = 'higopella_role_page';

// 上から優先して開く（管理者は管理者ページの切替ボタンで幹部・Higopelive!!へ移動できる）
const ROLE_SELECT_PAGES = [
	{ role: 'admin', href: 'admin/' },
	{ role: 'kanbu', href: 'kanbu/' },
	{ role: 'higopelive', href: 'higopelive/' }
];

initCommonLayout('role');

document.addEventListener('DOMContentLoaded', async () => {
	if (!await requirePageAuthentication()) return;

	const available = ROLE_SELECT_PAGES.filter((page) => hasRole(page.role));
	if (available.length === 0) {
		document.getElementById('role-select-checking').style.display = 'none';
		document.getElementById('role-select-denied').style.display = 'block';
		return;
	}

	const saved = sessionStorage.getItem(ROLE_PAGE_STORAGE_KEY);
	const destination = available.find((page) => page.role === saved) || available[0];
	sessionStorage.setItem(ROLE_PAGE_STORAGE_KEY, destination.role);
	window.location.replace(destination.href);
});
