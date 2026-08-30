/**
 * Higo-Pella Portal 共通スクリプト (src/js/menu.js)
 */

function initCommonLayout(activeKey = "") {
  const isSubDir = activeKey !== "home";
  const basePath = isSubDir ? "../" : "./";

  const menuItems = [
    { key: "home", title: "ホーム", href: `${basePath}` },
    { key: "booking", title: "練習予約", href: `${basePath}booking/` },
    { key: "forms", title: "申請フォーム", href: `${basePath}forms/` },
    { key: "searchYT", title: "YouTube検索", href: `${basePath}searchYT/` },
    { key: "admin", title: "管理者画面", href: `${basePath}admin/` }
  ];

  // ヘッダーロゴ画像（img）を削除し、テキストのみに更新
  const layoutHtml = `
    <header class="site-header">
      <button type="button" class="btn-menu" id="btn-open-drawer" onclick="toggleDrawerMenu(true)" aria-label="メニューを開く">☰</button>
      <a href="${basePath}" class="site-logo">
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

  initScrollTopButton();
}
