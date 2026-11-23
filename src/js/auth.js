const SESSION_VERIFIED_TTL_MS = 10 * 60 * 1000;
const FIREBASE_READY_TIMEOUT_MS = 10000;

(function loadFirebaseAuthModule() {
  if (document.getElementById('firebase-auth-module')) return;
  const script = document.createElement('script');
  script.type = 'module';
  script.id = 'firebase-auth-module';
  script.src = new URL('firebase-auth.js', document.currentScript ? document.currentScript.src : window.location.href).href;
  document.head.appendChild(script);
})();

const CONFIG = {
  GAS_API_URL: (typeof GAS_API_URLS !== 'undefined' && GAS_API_URLS[SITE_ENV]) || "https://script.google.com/macros/s/AKfycbynzAVfuPKHqT9jkKX-JPh5l42JCbR6d6d0sb9PT_TAilMhtDSY2PW2hOMdEPEMXBgT/exec",
  STORAGE_KEYS: {
    IS_LOGGED_IN: "higopella_is_logged_in",
    IS_ADMIN: "higopella_is_admin",
    ID_TOKEN: "higopella_id_token",
    LAST_ACCESS_TIME: "higopella_last_access_time",
    LAST_LOGIN_AT: "higopella_last_login_at",
    ROLES: "higopella_roles",
    SESSION_VERIFIED_AT: "higopella_session_verified_at"
  }
};

let currentIdToken = sessionStorage.getItem(CONFIG.STORAGE_KEYS.ID_TOKEN) || '';

function setCurrentIdToken(idToken) {
  currentIdToken = typeof idToken === 'string' ? idToken : '';
  if (currentIdToken) {
    sessionStorage.setItem(CONFIG.STORAGE_KEYS.ID_TOKEN, currentIdToken);
  } else {
    sessionStorage.removeItem(CONFIG.STORAGE_KEYS.ID_TOKEN);
  }
}

function getCurrentIdToken() {
  return currentIdToken;
}

function clearCurrentIdToken() {
  setCurrentIdToken('');
}

function checkUserLogin() {
  return Boolean(getCurrentIdToken()) && sessionStorage.getItem(CONFIG.STORAGE_KEYS.IS_LOGGED_IN) === "true";
}

function setUserLogin(status) {
  if (status) {
    sessionStorage.setItem(CONFIG.STORAGE_KEYS.IS_LOGGED_IN, "true");
  } else {
    sessionStorage.removeItem(CONFIG.STORAGE_KEYS.IS_LOGGED_IN);
    sessionStorage.removeItem(CONFIG.STORAGE_KEYS.SESSION_VERIFIED_AT);
    clearCurrentIdToken();
  }
  syncDrawerLogoutVisibility();
}

function checkAdminLogin() {
  return sessionStorage.getItem(CONFIG.STORAGE_KEYS.IS_ADMIN) === "true";
}

function setAdminLogin(status) {
  if (status) {
    sessionStorage.setItem(CONFIG.STORAGE_KEYS.IS_ADMIN, "true");
    return;
  }
  sessionStorage.removeItem(CONFIG.STORAGE_KEYS.IS_ADMIN);
}

function setUserRoles(roles) {
  const normalized = Array.isArray(roles) ? roles : [];
  if (normalized.length > 0) {
    sessionStorage.setItem(CONFIG.STORAGE_KEYS.ROLES, JSON.stringify(normalized));
  } else {
    sessionStorage.removeItem(CONFIG.STORAGE_KEYS.ROLES);
  }
  setAdminLogin(normalized.indexOf('admin') !== -1);
}

function getUserRoles() {
  try {
    const raw = sessionStorage.getItem(CONFIG.STORAGE_KEYS.ROLES);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function hasRole(role) {
  const roles = getUserRoles();
  if (roles.indexOf('admin') !== -1) return true;
  return roles.indexOf(role) !== -1;
}

function markSessionVerified() {
  sessionStorage.setItem(CONFIG.STORAGE_KEYS.SESSION_VERIFIED_AT, String(Date.now()));
}

function isSessionRecentlyVerified() {
  const raw = sessionStorage.getItem(CONFIG.STORAGE_KEYS.SESSION_VERIFIED_AT);
  if (!raw) return false;
  const verifiedAt = Number(raw);
  return Number.isFinite(verifiedAt) && Date.now() - verifiedAt <= SESSION_VERIFIED_TTL_MS;
}

function logoutUser() {
  clearCurrentIdToken();
  setUserLogin(false);
  setAdminLogin(false);
  clearLoginHistory();
  signOutFirebase().finally(() => {
    window.location.replace(typeof getSiteBasePath === 'function' ? getSiteBasePath() : '/');
  });
}

function recordLoginHistory() {
  localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_LOGIN_AT, String(Date.now()));
}

function clearLoginHistory() {
  localStorage.removeItem(CONFIG.STORAGE_KEYS.LAST_LOGIN_AT);
}

// ログアウトせずに一度でもログインした端末か
function hasLoginHistory() {
  return Boolean(localStorage.getItem(CONFIG.STORAGE_KEYS.LAST_LOGIN_AT));
}

const ACCOUNT_CHECKING_MESSAGE = 'アカウントを確認しています...';
const ACCOUNT_CHECK_FAILED_MESSAGE = 'アカウントが確認できませんでした';

let firebaseReadyPromise = null;

function waitForFirebase() {
  if (window.higopellaFirebase) return Promise.resolve(window.higopellaFirebase);
  if (!firebaseReadyPromise) {
    firebaseReadyPromise = new Promise((resolve) => {
      const timer = setTimeout(() => resolve(window.higopellaFirebase || null), FIREBASE_READY_TIMEOUT_MS);
      window.addEventListener('higopella-firebase-ready', () => {
        clearTimeout(timer);
        resolve(window.higopellaFirebase);
      }, { once: true });
    });
  }
  return firebaseReadyPromise;
}

async function getFirebaseUser() {
  const firebase = await waitForFirebase();
  if (!firebase) return null;
  await firebase.waitForInitialUser();
  return firebase.getCurrentUser();
}

// Firebase SDKが期限切れ前に自動更新するため、GAS呼び出しのたびに取得し直す
async function getFreshIdToken() {
  const user = await getFirebaseUser();
  if (!user) return '';
  try {
    const token = await user.getIdToken();
    setCurrentIdToken(token);
    return token;
  } catch (error) {
    return '';
  }
}

async function signInWithFirebaseGoogle() {
  const firebase = await waitForFirebase();
  if (!firebase) throw new Error('Firebaseを読み込めませんでした');
  await firebase.signInWithGoogle();
  const token = await getFreshIdToken();
  if (!token) throw new Error('ログイン情報を取得できませんでした');
  return token;
}

async function signOutFirebase() {
  const firebase = await waitForFirebase();
  if (!firebase) return;
  try {
    await firebase.signOutUser();
  } catch (error) {
    // Local sign-out state is already cleared.
  }
}

function getFirebaseLoginErrorMessage(error) {
  const code = error && error.code;
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return 'ログインがキャンセルされました。';
  if (code === 'auth/popup-blocked') return 'ポップアップがブロックされました。許可してから再度お試しください。';
  if (code === 'auth/unauthorized-domain') return 'このページからはログインできません（承認済みドメイン未設定）。';
  if (code === 'auth/operation-not-allowed') return 'Googleログインが有効になっていません（Firebaseの設定を確認してください）。';
  console.warn('[Firebaseログイン失敗]', error);
  return code ? `Googleログインに失敗しました（${code}）。` : 'Googleログインに失敗しました。';
}

async function trySilentReauth() {
  return Boolean(await getFreshIdToken());
}

async function verifySessionWithGas() {
  try {
    const idToken = await getFreshIdToken();
    if (idToken) {
      const result = await callGasApi('authenticateGoogle', { idToken });
      if (result.status === 'authenticated') {
        setUserLogin(true);
        setUserRoles(result.user && Array.isArray(result.user.roles) ? result.user.roles : (result.user && result.user.role ? [result.user.role] : []));
        recordLoginHistory();
        markSessionVerified();
        return true;
      }
    }
  } catch (error) {
    // Treat communication and authentication failures as logged out.
  }
  clearCurrentIdToken();
  setUserLogin(false);
  return false;
}

function syncDrawerLogoutVisibility() {
  const logoutFooter = document.querySelector('.drawer-footer');
  if (logoutFooter) logoutFooter.hidden = !checkUserLogin();
  const profileBtn = document.getElementById('btn-profile');
  if (profileBtn) profileBtn.hidden = !checkUserLogin();
}

async function requirePageAuthentication() {
  const homePath = typeof getSiteBasePath === 'function' ? getSiteBasePath() : '/';
  const showProgress = (message, type) => { if (typeof showProgressIndicator === 'function') showProgressIndicator(message, type); };
  const hideProgress = () => { if (typeof hideProgressIndicator === 'function') hideProgressIndicator(); };
  if (!getCurrentIdToken()) {
    showProgress(hasLoginHistory() ? ACCOUNT_CHECKING_MESSAGE : 'ログイン状態を確認しています...');
    await trySilentReauth();
  }

  if (!getCurrentIdToken()) {
    showProgress('ログイン画面へ移動しています...');
    window.location.replace(homePath);
    return false;
  }

  if (isSessionRecentlyVerified()) {
    hideProgress();
    return true;
  }

  showProgress(ACCOUNT_CHECKING_MESSAGE);
  if (await verifySessionWithGas()) {
    hideProgress();
    return true;
  }

  showProgress(`${ACCOUNT_CHECK_FAILED_MESSAGE}。ログイン画面へ戻ります`, 'error');
  setTimeout(() => window.location.replace(homePath), 2000);
  return false;
}