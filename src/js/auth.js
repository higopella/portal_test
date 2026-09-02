const CONFIG = {
  GAS_API_URL: "https://script.google.com/macros/s/AKfycbzSrC43yLEMa0WxqpNa7r4ONX17LSAkHzSGCO6Sw8QhebGKQQTlElZVsyFSBk_yFQIFfQ/exec",
  STORAGE_KEYS: {
    IS_LOGGED_IN: "higopella_is_logged_in",
    IS_ADMIN: "higopella_is_admin",
    LAST_ACCESS_TIME: "higopella_last_access_time"
  }
};

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