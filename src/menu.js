/**
 * Higo-Pella Portal 共通スクリプト (src/menu.js)
 * - 全画面共通のヘッダー・メニュー生成
 * - アクセス解析セッション管理（1時間経過判定）
 * - API通信・XSS対策・二重送信防止ヘルパー
 */

// ==========================================================================
// 1. 基本設定（GAS API URLの一元管理）
// ==========================================================================
const CONFIG = {
  // ★本番・テスト環境の切り替えはここ1箇所を変更するだけで全画面に反映されます
  GAS_API_URL: "https://script.google.com/macros/s/AKfycbzL5n1Kz_g_YOUR_DEPLOYMENT_ID/exec",
  STORAGE_KEYS: {
    IS_LOGGED_IN: "higopella_is_logged_in",
    IS_ADMIN: "higopella_is_admin",
    LAST_ACCESS_TIME: "higopella_last_access_time"
  }
};

// ==========================================================================
// 2. セキュリティ・XSS（悪意あるタグ混入）対策関数
// ==========================================================================
/**
 * 文字列中の特殊文字を安全なHTMLエンティティに変換します。
 * バンド名、代表者名、お知らせ文などの描画時は必ずこれを通します。
 * @param {string} str - エスケープする文字列
 * @returns {string} エスケープ後の文字列
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ==========================================================================
// 3. 通信処理ラッパー（エラーハンドリング共通化）
// ==========================================================================
/**
 * Google Apps Script API へ POST リクエストを送信します。
 * @param {string} action - GAS側のswitchで分岐するアクション名
 * @param {object} data - 送信するデータ
 * @returns {Promise<object>} APIレスポンス
 */
async function callGasApi(action, data = {}) {
  try {
    const payload = { action: action, data: data };
    const response = await fetch(CONFIG.GAS_API_URL, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "text/plain;charset=utf-8" }
    });

    if (!response.ok) {
      throw new Error(`HTTPエラー: ステータス ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error(`[API通信エラー] action: ${action}`, error);
    showToast("通信に失敗しました。電波状況をご確認ください。", "error");
    throw error;
  }
}

// ==========================================================================
// 4. UI操作・二重送信防止・トースト通知
// ==========================================================================
/**
 * 非同期処理中にボタンを無効化し、二重送信を防止します。
 * @param {HTMLButtonElement} button - 対象のボタン要素
 * @param {Function} asyncCallback - 実行する非同期関数
 * @param {string} loadingText - 通信中に表示するテキスト
 */
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

/**
 * 画面下部に簡易通知（トースト）を表示します。
 * @param {string} message - 表示するメッセージ
 * @param {string} type - 'info' または 'error'
 */
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

// ==========================================================================
// 5. アクセス解析（セッション管理）
// ==========================================================================
/**
 * 前回のアクセスから1時間以上経過している場合、GASへアクセス数+1を送信します。
 * 10分以内の連続操作時は端末負荷軽減のため時刻の更新のみ行います。
 */
function handleAccessAnalytics() {
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;
  const TEN_MINUTES = 10 * 60 * 1000;

  const lastAccess = parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.LAST_ACCESS_TIME) || "0", 10);

  if (!lastAccess || now - lastAccess >= ONE_HOUR) {
    // 1時間以上経過しているためカウントアップ
    localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_ACCESS_TIME, now.toString());
    callGasApi("recordAccess").catch(() => {});
  } else if (now - lastAccess >= TEN_MINUTES) {
    // 10分〜1時間の間は時刻のみ更新
    localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_ACCESS_TIME, now.toString());
  }
}

// ==========================================================================
// 6. 共通ヘッダー・ドロワーメニューの自動生成
// ==========================================================================
/**
 * ページ読み込み時に共通のヘッダー・メニュー・スクロールトップを自動生成します。
 * @param {string} activeKey - 現在のページ識別子 ('home' | 'booking' | 'forms' | 'searchYT' | 'admin')
 */
function initCommonLayout(activeKey = "") {
  // 現在の階層（ルートかサブディレクトリか）に応じて相対パスを調整
  const isSubDir = activeKey !== "home";
  const basePath = isSubDir ? "../" : "./";
  const iconPath = `${basePath}src/icon.png`;

  const menuItems = [
    { key: "home", title: "ホーム", href: `${basePath}index.html` },
    { key: "booking", title: "練習予約", href: `${basePath}booking/index.html` },
    { key: "forms", title: "申請フォーム", href: `${basePath}forms/index.html` },
    { key: "searchYT", title: "YouTube検索", href: `${basePath}searchYT/index.html` },
    { key: "admin", title: "管理者画面", href: `${basePath}admin/index.html` }
  ];

  const layoutHtml = `
    <header class="site-header">
      <a href="${basePath}index.html" class="site-logo">
        <img src="${iconPath}" alt="Logo" onerror="this.style.display='none'">
        <span>Higo-Pella Portal</span>
      </a>
      <button type="button" class="btn-menu" id="btn-open-drawer" aria-label="メニューを開く">☰</button>
    </header>

    <div class="drawer-overlay" id="drawer-overlay"></div>

    <nav class="drawer-menu" id="drawer-menu" aria-label="メインメニュー">
      <div class="drawer-header">
        <span class="drawer-title">メニュー</span>
        <button type="button" class="btn-close" id="btn-close-drawer" aria-label="メニューを閉じる">×</button>
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

  // ドロワー開閉イベント
  const openBtn = document.getElementById("btn-open-drawer");
  const closeBtn = document.getElementById("btn-close-drawer");
  const overlay = document.getElementById("drawer-overlay");
  const drawer = document.getElementById("drawer-menu");
  const scrollTopBtn = document.getElementById("btn-scroll-top");

  function openMenu() {
    drawer.classList.add("active");
    overlay.classList.add("active");
  }

  function closeMenu() {
    drawer.classList.remove("active");
    overlay.classList.remove("active");
  }

  if (openBtn) openBtn.addEventListener("click", openMenu);
  if (closeBtn) closeBtn.addEventListener("click", closeMenu);
  if (overlay) overlay.addEventListener("click", closeMenu);

  // Escキーで閉じる（アクセシビリティ対応）
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawer.classList.contains("active")) {
      closeMenu();
    }
  });

  // スクロールトップボタン
  window.addEventListener("scroll", () => {
    if (window.scrollY > 200) {
      scrollTopBtn.classList.add("visible");
    } else {
      scrollTopBtn.classList.remove("visible");
    }
  });

  if (scrollTopBtn) {
    scrollTopBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // アクセス解析を実行
  handleAccessAnalytics();
}
