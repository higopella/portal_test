// 全ページ共通のハンバーガーメニュー生成と、アクセス解析を行うスクリプト

function injectMenu(basePath) {
  const menuHTML = `
    <div class="drawer-overlay" id="drawer-overlay" onclick="toggleDrawer()"></div>
    <div class="drawer" id="drawer">
      <button class="drawer-close" onclick="toggleDrawer()">×</button>
      <div>
        <a href="${basePath}booking/" class="drawer-item">予約</a>
        <a href="${basePath}searchYT/" class="drawer-item">映像</a>
        <a href="${basePath}forms/" class="drawer-item">Forms</a>
      </div>
      <a href="${basePath}admin/" class="drawer-item" style="margin-top: auto; margin-bottom: 20px; color: var(--primary-dark); border-top: 1px solid var(--border);">管理者</a>
    </div>
  `;
  document.getElementById('global-menu-container').innerHTML = menuHTML;
}

function toggleDrawer() { 
  document.getElementById('drawer').classList.toggle('open'); 
  document.getElementById('drawer-overlay').classList.toggle('open'); 
}

function trackAccess(gasUrl) {
  const now = new Date().getTime();
  const lastAccess = localStorage.getItem('lastAccessTime');
  
  if (!lastAccess || (now - parseInt(lastAccess)) > 3600000) {
    // 1時間以上経過（または初回）ならカウントアップ
    fetch(gasUrl, {
      method: "POST",
      body: JSON.stringify({ action: "recordAccess" })
    }).catch(e => {}); 
    localStorage.setItem('lastAccessTime', now.toString());
  } else if ((now - parseInt(lastAccess)) > 600000) {
    // ★追加：10分（600,000ミリ秒）以上経過していた場合のみ時間を更新する
    localStorage.setItem('lastAccessTime', now.toString());
  }
}
