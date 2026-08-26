/**
 * Higo-Pella Portal 共通スクリプト (src/menu.js)
 */

const CONFIG = {
  // ★ここにGASのウェブアプリURL（.../exec）を記述してください
  GAS_API_URL: "https://script.google.com/macros/s/AKfycbzSrC43yLEMa0WxqpNa7r4ONX17LSAkHzSGCO6Sw8QhebGKQQTlElZVsyFSBk_yFQIFfQ/exec",
  STORAGE_KEYS: {
    IS_LOGGED_IN: "higopella_is_logged_in",
    OLD_IS_LOGGED_IN: "isLoggedIn",
    IS_ADMIN: "higopella_is_admin",
    OLD_IS_ADMIN: "isAdmin",
    LAST_ACCESS_TIME: "higopella_last_access_time"
  }
};

// 必須CSS自動注入（左側ドロワー対応）
function injectCoreStyles() {
  if (document.getElementById("injected-core-styles")) return;
  const style = document.createElement("style");
  style.id = "injected-core-styles";
  style.textContent = `
    :root {
      --bg: #f8fafc;
      --card: #ffffff;
      --text: #2c3e50;
      --text-sub: #64748b;
      --primary: #4fc3f7;
      --primary-light: #e1f5fe;
      --primary-dark: #0288d1;
      --border: #e2e8f0;
      --danger: #ef5350;
      --shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      --radius: 8px;
      --header-height: 56px;
    }
    body {
      margin: 0;
      padding-top: var(--header-height);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: var(--bg);
      color: var(--text);
    }
    .site-header {
      position: fixed;
      top: 0; left: 0; right: 0;
      height: var(--header-height);
      background-color: var(--card);
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; justify-content: flex-start;
      gap: 12px;
      padding: 0 16px;
      z-index: 1000;
      box-shadow: var(--shadow);
      box-sizing: border-box;
    }
    .site-logo {
      font-size: 1.1rem; font-weight: 700; color: var(--primary-dark);
      text-decoration: none; display: flex; align-items: center; gap: 8px;
    }
    .site-logo img { width: 28px; height: 28px; border-radius: 4px; }
    .btn-menu {
      background: none; border: none; font-size: 1.5rem; color: var(--text);
      cursor: pointer; padding: 6px; line-height: 1; touch-action: manipulation;
    }
    .drawer-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background-color: rgba(0, 0, 0, 0.4);
      z-index: 1010; opacity: 0; visibility: hidden; pointer-events: none;
      transition: opacity 0.25s ease, visibility 0.25s ease;
    }
    .drawer-overlay.active { opacity: 1; visibility: visible; pointer-events: auto; }
    /* 左側からスライドイン */
    .drawer-menu {
      position: fixed; top: 0; left: -280px; width: 260px; height: 100%;
      background-color: var(--card); box-shadow: 2px 0 12px rgba(0, 0, 0, 0.15);
      z-index: 1020; transition: left 0.25s ease;
      display: flex; flex-direction: column; padding: 20px 16px; box-sizing: border-box;
    }
    .drawer-menu.active { left: 0; }
    .drawer-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid var(--border);
    }
    .drawer-title { font-weight: bold; font-size: 1rem; color: var(--text); }
    .btn-close {
      background: none; border: none; font-size: 1.4rem; color: var(--text-sub);
      cursor: pointer; padding: 4px 8px;
    }
    .drawer-nav { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
    .drawer-nav a {
      display: block; padding: 10px 14px; color: var(--text); text-decoration: none;
      border-radius: var(--radius); font-weight: 500;
    }
    .drawer-nav a:hover, .drawer-nav a.current {
      background-color: var(--primary-light); color: var(--primary-dark);
    }
    .btn-scroll-top {
      position: fixed; bottom: 24px; right: 20px; width: 44px; height: 44px;
      background-color: var(--card); border: 1px solid var(--border); border-radius: 50%;
      box-shadow: var(--shadow); color: var(--text-sub); font-size: 1.2rem;
      display: none; align-items: center; justify-content: center; cursor: pointer; z-index: 900;
    }
    .btn-scroll-top.visible { display: flex; }
    .toast-container {
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      z-index: 2000; display: flex; flex-direction: column; gap: 8px; pointer-events: none;
    }
    .toast {
      background-color: #333333; color: #ffffff; padding: 10px 20px;
      border-radius: 20px; font-size: 0.9rem; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      opacity: 0; transform: translateY(10px); transition: opacity 0.25s ease, transform 0.25s ease;
    }
    .toast.toast-error { background-color: var(--danger); }
    .toast.show { opacity: 1; transform: translateY(0); }
  `;
  document.head.appendChild(style);
}

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

window.toggleDrawerMenu = function(isOpen) {
  const drawer = document.getElementById("drawer-menu");
  const overlay = document.getElementById("drawer-overlay");
  if (!drawer || !overlay) return;
  if (isOpen) {
    drawer.classList.add("active");
    overlay.classList.add("active");
  } else {
    drawer.classList.remove("active");
    overlay.classList.remove("active");
  }
};

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function callGasApi(action, data = {}) {
  try {
    const payload = { action: action, data: data };
    const response = await fetch(CONFIG.GAS_API_URL, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "text/plain;charset=utf-8" }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(`[GAS通信エラー] action: ${action}`, error);
    throw error;
  }
}

async function withButtonLoading(button, asyncCallback, loadingText = "通信中...") {
  if (!button || button.disabled) return;
  const originalText = button.textContent;
  button.disabled = true;
  button.classList.add("is-loading");
  button.textContent = loadingText;
  try {
    await asyncCallback();
  } finally {
    button.disabled = false;
    button.classList.remove("is-loading");
    button.textContent = originalText;
  }
}

function showToast(message, type = "info") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "toast-error" : ""}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function initCommonLayout(activeKey = "") {
  injectCoreStyles();

  const isSubDir = activeKey !== "home";
  const basePath = isSubDir ? "../" : "./";
  const iconPath = `${basePath}src/icon.png`;

  // ディレクトリ指定のリンク
  const menuItems = [
    { key: "home", title: "ホーム", href: `${basePath}` },
    { key: "booking", title: "練習予約", href: `${basePath}booking/` },
    { key: "forms", title: "申請フォーム", href: `${basePath}forms/` },
    { key: "searchYT", title: "YouTube検索", href: `${basePath}searchYT/` },
    { key: "admin", title: "管理者画面", href: `${basePath}admin/` }
  ];

  const layoutHtml = `
    <header class="site-header">
      <button type="button" class="btn-menu" id="btn-open-drawer" onclick="toggleDrawerMenu(true)" aria-label="メニューを開く">☰</button>
      <a href="${basePath}" class="site-logo">
        <img src="${iconPath}" alt="Logo" onerror="this.style.display='none'">
        <span>Higo-Pella Portal</span>
      </a>
    </header>

    <div class="drawer-overlay" id="drawer-overlay" onclick="toggleDrawerMenu(false)"></div>

    <nav class="drawer-menu" id="drawer-menu" aria-label="メインメニュー">
      <div class="drawer-header">
        <span class="drawer-title">メニュー</span>
        <button type="button" class="btn-close" id="btn-close-drawer" onclick="toggleDrawerMenu(false)" aria-label="メニューを閉じる">×</button>
      </div>
      <ul class="drawer-nav">
        ${menuItems
          .map(
            (item) =>
              `<li><a href="${item.href}" class="${item.key === activeKey ? "current" : ""}">${escapeHtml(item.title)}</a></li>`
          )
          .join("")}
      </ul>
    </nav>

    <button type="button" class="btn-scroll-top" id="btn-scroll-top" aria-label="ページ最上部へスクロール">↑</button>
  `;

  document.body.insertAdjacentHTML("afterbegin", layoutHtml);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") toggleDrawerMenu(false);
  });

  const scrollTopBtn = document.getElementById("btn-scroll-top");
  window.addEventListener("scroll", () => {
    if (window.scrollY > 200) scrollTopBtn.classList.add("visible");
    else scrollTopBtn.classList.remove("visible");
  });

  if (scrollTopBtn) {
    scrollTopBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }
}
