const SCHEDULE_DEVICE_CACHE_DB = "higo-pella-schedule";
const SCHEDULE_DEVICE_CACHE_STORE = "snapshots";
const SCHEDULE_DEVICE_CACHE_KEY = "current-window";
const SCHEDULE_REFRESH_TIMEOUT_MS = 10000;

function openScheduleDeviceCache() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SCHEDULE_DEVICE_CACHE_DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(SCHEDULE_DEVICE_CACHE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readScheduleDeviceCache() {
  try {
    const database = await openScheduleDeviceCache();
    return await new Promise((resolve, reject) => {
      const request = database.transaction(SCHEDULE_DEVICE_CACHE_STORE, "readonly")
        .objectStore(SCHEDULE_DEVICE_CACHE_STORE)
        .get(SCHEDULE_DEVICE_CACHE_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("[カレンダー端末キャッシュ読込失敗]", error);
    return null;
  }
}

async function writeScheduleDeviceCache(record) {
  try {
    const database = await openScheduleDeviceCache();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(SCHEDULE_DEVICE_CACHE_STORE, "readwrite");
      transaction.objectStore(SCHEDULE_DEVICE_CACHE_STORE).put(record, SCHEDULE_DEVICE_CACHE_KEY);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.warn("[カレンダー端末キャッシュ保存失敗]", error);
  }
}

async function clearScheduleDeviceCache() {
  try {
    const database = await openScheduleDeviceCache();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(SCHEDULE_DEVICE_CACHE_STORE, "readwrite");
      transaction.objectStore(SCHEDULE_DEVICE_CACHE_STORE).delete(SCHEDULE_DEVICE_CACHE_KEY);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.warn("[カレンダー端末キャッシュ削除失敗]", error);
  }
}

function withScheduleRefreshTimeout(promise) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("カレンダーの更新が10秒以内に完了しませんでした")), SCHEDULE_REFRESH_TIMEOUT_MS);
    })
  ]);
}
