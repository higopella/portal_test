const NOTICE_DEVICE_CACHE_DB = "higo-pella-notices";
const NOTICE_DEVICE_CACHE_STORE = "snapshots";
const NOTICE_DEVICE_CACHE_KEY = "current";
const NOTICE_DEVICE_CACHE_VERSION = 1;
const NOTICE_REFRESH_TIMEOUT_MS = 10000;

function openNoticeDeviceCache() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(NOTICE_DEVICE_CACHE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(NOTICE_DEVICE_CACHE_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readNoticeDeviceCache() {
  try {
    const database = await openNoticeDeviceCache();
    return await new Promise((resolve, reject) => {
      const request = database.transaction(NOTICE_DEVICE_CACHE_STORE, "readonly")
        .objectStore(NOTICE_DEVICE_CACHE_STORE).get(NOTICE_DEVICE_CACHE_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("[お知らせ端末キャッシュ読込失敗]", error);
    return null;
  }
}

async function writeNoticeDeviceCache(notices) {
  try {
    const database = await openNoticeDeviceCache();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(NOTICE_DEVICE_CACHE_STORE, "readwrite");
      transaction.objectStore(NOTICE_DEVICE_CACHE_STORE).put({
        version: NOTICE_DEVICE_CACHE_VERSION,
        fetchedAt: Date.now(),
        notices
      }, NOTICE_DEVICE_CACHE_KEY);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.warn("[お知らせ端末キャッシュ保存失敗]", error);
  }
}

async function clearNoticeDeviceCache() {
  try {
    const database = await openNoticeDeviceCache();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(NOTICE_DEVICE_CACHE_STORE, "readwrite");
      transaction.objectStore(NOTICE_DEVICE_CACHE_STORE).clear();
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.warn("[お知らせ端末キャッシュ削除失敗]", error);
  }
}

function withNoticeRefreshTimeout(promise) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("お知らせの更新が10秒以内に完了しませんでした")), NOTICE_REFRESH_TIMEOUT_MS);
    })
  ]);
}
