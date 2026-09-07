const CONFIG = {
  GAS_API_URL: "https://script.google.com/macros/s/AKfycbxLEU_cnLSP1Sb53hwqbz6JZynbcOiwrXkiFTI_Ev540bgndI0y_egVRSLJaKx15cmb/exec",
  STORAGE_KEYS: {
    IS_LOGGED_IN: "higopella_is_logged_in",
    IS_ADMIN: "higopella_is_admin",
    LAST_ACCESS_TIME: "higopella_last_access_time"
  }
};

let currentIdToken = '';

function setCurrentIdToken(idToken) {
  currentIdToken = typeof idToken === 'string' ? idToken : '';
}

function getCurrentIdToken() {
  return currentIdToken;
}

function clearCurrentIdToken() {
  currentIdToken = '';
}

function checkUserLogin() {
  return sessionStorage.getItem(CONFIG.STORAGE_KEYS.IS_LOGGED_IN) === "true";
}

function setUserLogin(status) {
  if (status) {
    sessionStorage.setItem(CONFIG.STORAGE_KEYS.IS_LOGGED_IN, "true");
  } else {
    sessionStorage.removeItem(CONFIG.STORAGE_KEYS.IS_LOGGED_IN);
  }
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