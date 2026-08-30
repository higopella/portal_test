const CONFIG = {
  // ★GASのウェブアプリURL（.../exec）
  GAS_API_URL: "https://script.google.com/macros/s/AKfycbzSrC43yLEMa0WxqpNa7r4ONX17LSAkHzSGCO6Sw8QhebGKQQTlElZVsyFSBk_yFQIFfQ/exec",
  STORAGE_KEYS: {
    IS_LOGGED_IN: "higopella_is_logged_in",
    OLD_IS_LOGGED_IN: "isLoggedIn",
    IS_ADMIN: "higopella_is_admin",
    OLD_IS_ADMIN: "isAdmin",
    LAST_ACCESS_TIME: "higopella_last_access_time"
  }
};

function checkUserLogin() {
  return (
    localStorage.getItem(CONFIG.STORAGE_KEYS.IS_LOGGED_IN) === "true" ||
    localStorage.getItem(CONFIG.STORAGE_KEYS.OLD_IS_LOGGED_IN) === "true"
  );
}

function setUserLogin(status) {
  if (status) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.IS_LOGGED_IN, "true");
    localStorage.setItem(CONFIG.STORAGE_KEYS.OLD_IS_LOGGED_IN, "true");
  } else {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.IS_LOGGED_IN);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.OLD_IS_LOGGED_IN);
  }
}

function checkAdminLogin() {
  return localStorage.getItem(CONFIG.STORAGE_KEYS.IS_ADMIN) === "true";
}

function setAdminLogin(status) {
  if (status) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.IS_ADMIN, "true");
    return;
  }
  localStorage.removeItem(CONFIG.STORAGE_KEYS.IS_ADMIN);
  localStorage.removeItem(CONFIG.STORAGE_KEYS.OLD_IS_ADMIN);
}