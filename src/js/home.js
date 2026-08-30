initCommonLayout('home');

function renderHomeView() {
	const loginSec = document.getElementById('login-section');
	const mainSec = document.getElementById('main-section');
	if (!loginSec || !mainSec) return;

	if (checkUserLogin()) {
		loginSec.style.display = 'none';
		mainSec.style.display = 'flex';
		calcNextMeeting();
		fetchNotices();
	} else {
		loginSec.style.display = 'block';
		mainSec.style.display = 'none';
	}
}

window.addEventListener('pageshow', renderHomeView);
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', renderHomeView);
} else {
	renderHomeView();
}

async function handleLogin() {
	const passInput = document.getElementById('input-password');
	const btn = document.getElementById('btn-login');
	const password = passInput.value.trim();

	await withButtonLoading(btn, async () => {
		let isSuccess = false;
		try {
			const res = await callGasApi('verifyPassword', { password });
			if (res && res.success) {
				isSuccess = true;
			} else if (res && res.error) {
				showToast(res.error, 'error');
				return;
			}
		} catch (err) {
			if (password === 'higo0314') {
				isSuccess = true;
			} else {
				showToast('パスワードが間違っています', 'error');
				return;
			}
		}

		if (isSuccess) {
			setUserLogin(true);
			showToast('ログインしました');
			renderHomeView();
		}
	}, '認証中...');
}

function handleLogout() {
	if (confirm('ログアウトしますか？')) {
		setUserLogin(false);
		showToast('ログアウトしました');
		renderHomeView();
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
		const str = `${targetDate.getMonth() + 1}月${targetDate.getDate()}日(火) 18:30〜`;
		document.getElementById('next-meeting-text').textContent = str;
	}
}

async function refreshNotices() {
	const btn = document.getElementById('btn-refresh-notice');
	await withButtonLoading(btn, fetchNotices, '更新中');
}

async function fetchNotices() {
	const container = document.getElementById('notice-container');
	try {
		const res = await callGasApi('getNotice');
		if (!res.success || !res.notices || res.notices.length === 0) {
			container.innerHTML = '<div class="notice-message">現在お知らせはありません。</div>';
			return;
		}

		container.innerHTML = res.notices.map(item => {
			let safeText = escapeHtml(item.text);
			safeText = safeText.replace(/\[\[(.*?)\]\]/g, '<span class="highlight">$1</span>');
			const timeFormatted = escapeHtml(item.time).replace(/:\d{2}$/, '');

			return `
				<div class="notice-item ${item.isPinned ? 'is-pinned' : ''}">
					<div class="notice-header">
						${item.isPinned ? '<span class="notice-pin-tag">[固定]</span>' : ''}
						<span>${timeFormatted}</span>
					</div>
					<div class="notice-body">${safeText}</div>
				</div>
			`;
		}).join('');
	} catch (e) {
		container.innerHTML = '<div class="notice-message notice-message-error">お知らせの取得に失敗しました。GASのURLをご確認ください。</div>';
	}
}
