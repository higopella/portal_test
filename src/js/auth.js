const CONFIG = {
  GAS_API_URL: "https://script.google.com/macros/s/AKfycbxLEU_cnLSP1Sb53hwqbz6JZynbcOiwrXkiFTI_Ev540bgndI0y_egVRSLJaKx15cmb/exec",
  STORAGE_KEYS: {
    IS_LOGGED_IN: "higopella_is_logged_in",
    IS_ADMIN: "higopella_is_admin",
    ID_TOKEN: "higopella_id_token",
    LAST_ACCESS_TIME: "higopella_last_access_time"
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

function logoutUser() {
  clearCurrentIdToken();
  setUserLogin(false);
  setAdminLogin(false);
  window.location.replace(window.location.pathname.includes('/portal_test/') ? '/portal_test/' : '/');
}

function syncDrawerLogoutVisibility() {
  const logoutFooter = document.querySelector('.drawer-footer');
  if (logoutFooter) logoutFooter.hidden = !checkUserLogin();
}

async function requirePageAuthentication() {
  const homePath = window.location.pathname.includes('/portal_test/') ? '/portal_test/' : '/';
  if (!getCurrentIdToken()) {
    window.location.replace(homePath);
    return false;
  }

  try {
    const result = await callGasApi('authenticateGoogle', { idToken: getCurrentIdToken() });
    if (result.status === 'authenticated') {
      setUserLogin(true);
      setAdminLogin(result.user && result.user.role === 'admin');
      return true;
    }
  } catch (error) {
    // Treat communication and authentication failures as logged out.
  }

  clearCurrentIdToken();
  setUserLogin(false);
  window.location.replace(homePath);
  return false;
}