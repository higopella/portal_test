initCommonLayout('searchYT');

let allVideos = [];
let currentType = 'ALL';
let visibleVideoCount = 40;

document.addEventListener('DOMContentLoaded', async () => {
	if (!await requirePageAuthentication()) return;
	const selectPlaylist = document.getElementById('select-playlist');
	if (selectPlaylist) {
		selectPlaylist.addEventListener('change', () => resetVideoList());
	}
	const inputSearch = document.getElementById('input-search');
	if (inputSearch) {
		inputSearch.addEventListener('input', () => resetVideoList());
	}
	const refreshBtn = document.getElementById('btn-refresh');
	if (refreshBtn) {
		refreshBtn.addEventListener('click', refreshVideoCatalog);
	}
	document.querySelectorAll('.tab-btn').forEach((button) => {
		button.addEventListener('click', () => setVideoType(button.dataset.videoType || 'ALL'));
	});
	document.getElementById('btn-load-more')?.addEventListener('click', () => {
		visibleVideoCount += 40;
		filterVideos();
	});
	refreshVideoCatalog();
});

async function refreshVideoCatalog() {
	const selectEl = document.getElementById('select-playlist');
	const refreshBtn = document.getElementById('btn-refresh');
	const cached = await readYouTubeCatalogCache();
	if (cached && cached.version === YOUTUBE_CATALOG_CACHE_VERSION && cached.catalog) {
		applyVideoCatalog(cached.catalog, selectEl);
	}
	await withButtonLoading(refreshBtn, async () => {
		try {
			const result = await callGasApi('getVideoCatalog');
			if (!result.success) throw new Error(result.error || '動画一覧の取得に失敗しました');
			applyVideoCatalog(result, selectEl);
			await writeYouTubeCatalogCache(result);
		} catch (error) {
			if (allVideos.length === 0) showVideoMessage('動画の読み込みに失敗しました', true);
			else showToast('最新の動画一覧を取得できませんでした', 'error');
		}
	}, '更新中');
}

function applyVideoCatalog(catalog, selectEl) {
	const selectedPlaylistId = selectEl.value || 'ALL';
	allVideos = Array.isArray(catalog.videos) ? catalog.videos : [];
	selectEl.textContent = '';
	const allOption = document.createElement('option');
	allOption.value = 'ALL';
	allOption.textContent = 'すべての動画';
	selectEl.appendChild(allOption);
	(catalog.playlists || []).forEach((playlist) => {
		const option = document.createElement('option');
		option.value = playlist.id;
		option.textContent = playlist.title;
		selectEl.appendChild(option);
	});
	selectEl.value = Array.from(selectEl.options).some(option => option.value === selectedPlaylistId)
		? selectedPlaylistId : 'ALL';
	resetVideoList();
}

function resetVideoList() {
	visibleVideoCount = 40;
	filterVideos();
}

function showVideoMessage(message, isError = false) {
	const listContainer = document.getElementById('video-list');
	const loadMoreButton = document.getElementById('btn-load-more');
	listContainer.textContent = '';
	const element = document.createElement('div');
	element.className = `video-message${isError ? ' video-message-error' : ''}`;
	element.textContent = message;
	listContainer.appendChild(element);
	if (loadMoreButton) loadMoreButton.hidden = true;
}

function setVideoType(type) {
	currentType = type;
	document.getElementById('tab-all').classList.toggle('active', type === 'ALL');
	document.getElementById('tab-regular').classList.toggle('active', type === 'REGULAR');
	document.getElementById('tab-shorts').classList.toggle('active', type === 'SHORTS');
	resetVideoList();
}

function filterVideos() {
	const query = document.getElementById('input-search').value.toLowerCase().trim();
	const playlistId = document.getElementById('select-playlist').value;
	const listContainer = document.getElementById('video-list');

	let filtered = allVideos.filter(v => {
		const matchesQuery = String(v.title ?? '').toLowerCase().includes(query);
		if (!matchesQuery) return false;
		if (playlistId !== 'ALL' && (!Array.isArray(v.playlistIds) || !v.playlistIds.includes(playlistId))) return false;

		if (currentType === 'REGULAR') return !v.isShort;
		if (currentType === 'SHORTS') return v.isShort;
		return true;
	});

	if (filtered.length === 0) {
		showVideoMessage('該当する動画がありません');
		return;
	}

	listContainer.textContent = '';
	filtered.slice(0, visibleVideoCount).forEach((v) => {
		const dateStr = v.publishedAt ? v.publishedAt.split('T')[0] : '';
		const youtubeUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(v.videoId)}`;
		const card = document.createElement('a');
		card.href = youtubeUrl;
		card.target = '_blank';
		card.rel = 'noopener noreferrer';
		card.className = 'video-card';
		const img = document.createElement('img');
		img.src = v.thumbnail;
		img.alt = v.title;
		img.className = 'video-thumb';
		img.loading = 'lazy';
		const info = document.createElement('div');
		info.className = 'video-info';
		const title = document.createElement('span');
		title.className = 'video-title';
		title.textContent = v.title;
		const date = document.createElement('span');
		date.className = 'video-date';
		date.textContent = dateStr;
		info.appendChild(title);
		info.appendChild(date);
		card.appendChild(img);
		card.appendChild(info);
		listContainer.appendChild(card);
	});
	const loadMoreButton = document.getElementById('btn-load-more');
	if (loadMoreButton) loadMoreButton.hidden = filtered.length <= visibleVideoCount;
}
