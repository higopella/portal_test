const SCHEDULE_DEVICE_CACHE_DB = "higo-pella-schedule";
const SCHEDULE_DEVICE_CACHE_STORE = "snapshots";
const SCHEDULE_DEVICE_CACHE_KEY = "current-window";
const SCHEDULE_DEVICE_CACHE_STORAGE_KEY = "higo-pella-schedule-cache";
const SCHEDULE_DEVICE_CACHE_VERSION = 6;
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
  const localRecord = readScheduleLocalCache();
  try {
    const database = await openScheduleDeviceCache();
    return await new Promise((resolve, reject) => {
      const request = database.transaction(SCHEDULE_DEVICE_CACHE_STORE, "readonly")
        .objectStore(SCHEDULE_DEVICE_CACHE_STORE)
        .get(SCHEDULE_DEVICE_CACHE_KEY);
      request.onsuccess = () => {
        const indexedRecord = request.result;
        resolve((indexedRecord?.fetchedAt || 0) >= (localRecord?.fetchedAt || 0)
          ? indexedRecord || localRecord
          : localRecord);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("[カレンダー端末キャッシュ読込失敗]", error);
    return readScheduleLocalCache();
  }
}

function readScheduleLocalCache() {
  try {
    const value = localStorage.getItem(SCHEDULE_DEVICE_CACHE_STORAGE_KEY);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.warn("[カレンダー代替キャッシュ読込失敗]", error);
    return null;
  }
}

async function writeScheduleDeviceCache(record) {
  try {
    const current = readScheduleLocalCache();
    if (!current || (current.fetchedAt || 0) <= (record.fetchedAt || 0)) {
      localStorage.setItem(SCHEDULE_DEVICE_CACHE_STORAGE_KEY, JSON.stringify(record));
    }
  } catch (error) {
    console.warn("[カレンダー代替キャッシュ保存失敗]", error);
  }
  try {
    const database = await openScheduleDeviceCache();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(SCHEDULE_DEVICE_CACHE_STORE, "readwrite");
      const store = transaction.objectStore(SCHEDULE_DEVICE_CACHE_STORE);
      const getRequest = store.get(SCHEDULE_DEVICE_CACHE_KEY);
      getRequest.onsuccess = () => {
        const current = getRequest.result;
        const isOlderSameSession = current && current.sessionId === record.sessionId &&
          current.requestId > record.requestId;
        if (!isOlderSameSession) store.put(record, SCHEDULE_DEVICE_CACHE_KEY);
      };
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.warn("[カレンダー端末キャッシュ保存失敗]", error);
  }
}

async function clearScheduleDeviceCache() {
  try {
    localStorage.removeItem(SCHEDULE_DEVICE_CACHE_STORAGE_KEY);
  } catch (error) {
    console.warn("[カレンダー代替キャッシュ削除失敗]", error);
  }
  try {
    const database = await openScheduleDeviceCache();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(SCHEDULE_DEVICE_CACHE_STORE, "readwrite");
      transaction.objectStore(SCHEDULE_DEVICE_CACHE_STORE).clear();
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
