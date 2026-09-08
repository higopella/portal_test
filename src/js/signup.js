const SIGNUP_GOOGLE_OAUTH_CLIENT_ID = '65097864960-vbe2ukqcoi9mpqc9capgtu9mak6vf4qs.apps.googleusercontent.com';

document.addEventListener('DOMContentLoaded', () => {
  initializeSignupGoogleLogin();

  const profileForm = document.getElementById('signup-profile-form');
  if (profileForm) profileForm.addEventListener('submit', requestSignupOtp);

  const otpForm = document.getElementById('signup-otp-form');
  if (otpForm) otpForm.addEventListener('submit', verifySignupOtp);
});

function initializeSignupGoogleLogin() {
  const buttonContainer = document.getElementById('signup-google-button');
  if (!buttonContainer) return;
  if (!window.google || !google.accounts || !google.accounts.id) {
    const googleScript = document.getElementById('google-identity-script');
    if (googleScript) googleScript.addEventListener('load', initializeSignupGoogleLogin, { once: true });
    return;
  }

  google.accounts.id.initialize({
    client_id: SIGNUP_GOOGLE_OAUTH_CLIENT_ID,
    callback: handleSignupGoogleCredential
  });
  google.accounts.id.renderButton(buttonContainer, { theme: 'outline', size: 'large', width: 280 });
}

async function handleSignupGoogleCredential(response) {
  if (!response || !response.credential) {
    showToast('Google認証に失敗しました', 'error');
    return;
  }

  setCurrentIdToken(response.credential);
  try {
    const result = await callGasApi('authenticateGoogle', { idToken: response.credential });
    if (result.status === 'authenticated') {
      setUserLogin(true);
      setAdminLogin(result.user && result.user.role === 'admin');
      window.location.replace('../');
      return;
    }
    if (result.status === 'unregistered') {
      document.getElementById('signup-google-panel').classList.add('is-hidden');
      document.getElementById('signup-profile-form').classList.remove('is-hidden');
      return;
    }
    clearCurrentIdToken();
    showToast(result.error || '登録を開始できません', 'error');
  } catch (error) {
    clearCurrentIdToken();
    showToast('認証に失敗しました', 'error');
  }
}

async function requestSignupOtp(event) {
  event.preventDefault();
  const button = document.getElementById('btn-request-otp');
  const schoolEmail = document.getElementById('signup-school-email').value.trim();
  const nickname = document.getElementById('signup-nickname').value.trim();
  const idToken = getCurrentIdToken();
  if (!idToken) return;

  await withButtonLoading(button, async () => {
    try {
      const result = await callGasApi('requestOtp', { idToken, schoolEmail, nickname });
      if (!result.success) {
        showToast(result.error || 'パスキーを送信できません', 'error');
        return;
      }
      document.getElementById('signup-profile-form').classList.add('is-hidden');
      document.getElementById('signup-otp-form').classList.remove('is-hidden');
      showToast('パスキーを送信しました');
    } catch (error) {
      showToast('パスキーの送信に失敗しました', 'error');
    }
  }, '送信中...');
}

async function verifySignupOtp(event) {
  event.preventDefault();
  const button = document.getElementById('btn-verify-otp');
  const schoolEmail = document.getElementById('signup-school-email').value.trim();
  const nickname = document.getElementById('signup-nickname').value.trim();
  const otp = document.getElementById('signup-otp').value.trim();
  const idToken = getCurrentIdToken();
  if (!idToken) return;

  await withButtonLoading(button, async () => {
    try {
      const result = await callGasApi('verifyOtp', { idToken, schoolEmail, nickname, otp });
      if (!result.success) {
        showToast(result.error || '確認コードを確認できません', 'error');
        return;
      }
      setUserLogin(true);
      setAdminLogin(result.user && result.user.role === 'admin');
      showToast('登録が完了しました');
      window.location.replace('../');
    } catch (error) {
      showToast('登録に失敗しました', 'error');
    }
  }, '登録中...');
}