const YOUTUBE_CATALOG_CACHE_DB = 'higo-pella-youtube';
const YOUTUBE_CATALOG_CACHE_STORE = 'catalog';
const YOUTUBE_CATALOG_CACHE_KEY = 'current';
const YOUTUBE_CATALOG_CACHE_VERSION = 1;
const YOUTUBE_CATALOG_TTL_MS = 12 * 60 * 60 * 1000;

function openYouTubeCatalogCache() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(YOUTUBE_CATALOG_CACHE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(YOUTUBE_CATALOG_CACHE_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readYouTubeCatalogCache() {
  try {
    const database = await openYouTubeCatalogCache();
    return await new Promise((resolve, reject) => {
      const request = database.transaction(YOUTUBE_CATALOG_CACHE_STORE, 'readonly')
        .objectStore(YOUTUBE_CATALOG_CACHE_STORE).get(YOUTUBE_CATALOG_CACHE_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('[YouTube端末キャッシュ読込失敗]', error);
    return null;
  }
}

function isYouTubeCatalogCacheValid(record) {
  return Boolean(
    record &&
    record.version === YOUTUBE_CATALOG_CACHE_VERSION &&
    Array.isArray(record.videos) &&
    Number.isFinite(record.fetchedAt) &&
    Date.now() - record.fetchedAt < YOUTUBE_CATALOG_TTL_MS
  );
}

async function writeYouTubeCatalogCache(videos, playlists) {
  try {
    const database = await openYouTubeCatalogCache();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(YOUTUBE_CATALOG_CACHE_STORE, 'readwrite');
      transaction.objectStore(YOUTUBE_CATALOG_CACHE_STORE).put({
        version: YOUTUBE_CATALOG_CACHE_VERSION,
        fetchedAt: Date.now(),
        videos,
        playlists
      }, YOUTUBE_CATALOG_CACHE_KEY);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.warn('[YouTube端末キャッシュ保存失敗]', error);
  }
}

async function clearYouTubeCatalogCache() {
  try {
    const database = await openYouTubeCatalogCache();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(YOUTUBE_CATALOG_CACHE_STORE, 'readwrite');
      transaction.objectStore(YOUTUBE_CATALOG_CACHE_STORE).clear();
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.warn('[YouTube端末キャッシュ削除失敗]', error);
  }
}
