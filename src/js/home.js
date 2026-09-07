initCommonLayout('home');

const GOOGLE_OAUTH_CLIENT_ID = '65097864960-vbe2ukqcoi9mpqc9capgtu9mak6vf4qs.apps.googleusercontent.com';
let pendingGoogleIdentity = null;

function renderHomeView() {
	const loginSec = document.getElementById('login-section');
	const mainSec = document.getElementById('main-section');
	if (!loginSec || !mainSec) return;

	if (getCurrentIdToken()) {
		loginSec.style.display = 'none';
		mainSec.style.display = 'flex';
		calcNextMeeting();
		fetchNotices();
	} else {
		loginSec.style.display = 'block';
		mainSec.style.display = 'none';
	}
}

document.addEventListener('DOMContentLoaded', () => {
	initializeGoogleLogin();

	const schoolEmailForm = document.getElementById('form-school-email');
	if (schoolEmailForm) schoolEmailForm.addEventListener('submit', handleSchoolEmailSubmit);

	const otpForm = document.getElementById('form-otp');
	if (otpForm) otpForm.addEventListener('submit', handleOtpSubmit);

	const refreshNoticeBtn = document.getElementById('btn-refresh-notice');
	if (refreshNoticeBtn) {
		refreshNoticeBtn.addEventListener('click', refreshNotices);
	}

	const logoutBtn = document.querySelector('.logout-button');
	if (logoutBtn) {
		logoutBtn.addEventListener('click', handleLogout);
	}

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
			pendingGoogleIdentity = response.credential;
			showSchoolEmailPanel();
			return;
		}
		clearCurrentIdToken();
		showToast(result.error || 'ログインできません', 'error');
	} catch (error) {
		clearCurrentIdToken();
		showToast('認証に失敗しました', 'error');
	}
}

async function handleSchoolEmailSubmit(event) {
	event.preventDefault();
	const form = event.currentTarget;
	const button = document.getElementById('btn-school-email');
	const schoolEmail = document.getElementById('input-school-email').value.trim();
	if (!pendingGoogleIdentity) return;

	await withButtonLoading(button, async () => {
		try {
			const result = await callGasApi('requestOtp', { idToken: pendingGoogleIdentity, schoolEmail: schoolEmail });
			if (!result.success) {
				showToast(result.error || '確認コードを送信できません', 'error');
				return;
			}
			form.classList.add('is-hidden');
			document.getElementById('form-otp').classList.remove('is-hidden');
			showToast('確認コードを送信しました');
		} catch (error) {
			showToast('確認コードの送信に失敗しました', 'error');
		}
	}, '送信中...');
}

async function handleOtpSubmit(event) {
	event.preventDefault();
	const button = document.getElementById('btn-otp');
	const schoolEmail = document.getElementById('input-school-email').value.trim();
	const otp = document.getElementById('input-otp').value.trim();
	if (!pendingGoogleIdentity) return;

	await withButtonLoading(button, async () => {
		try {
			const result = await callGasApi('verifyOtp', { idToken: pendingGoogleIdentity, schoolEmail: schoolEmail, otp: otp });
			if (!result.success) {
				showToast(result.error || '確認コードを確認できません', 'error');
				return;
			}
			setCurrentIdToken(pendingGoogleIdentity);
			pendingGoogleIdentity = null;
			setUserLogin(true);
			showToast('登録とログインが完了しました');
			renderHomeView();
		} catch (error) {
			showToast('確認に失敗しました', 'error');
		}
	}, '確認中...');
}

function showSchoolEmailPanel() {
	document.getElementById('google-login-panel').classList.add('is-hidden');
	document.getElementById('form-school-email').classList.remove('is-hidden');
}

function handleLogout() {
	if (confirm('ログアウトしますか？')) {
		clearCurrentIdToken();
		pendingGoogleIdentity = null;
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
