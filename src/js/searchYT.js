initCommonLayout('searchYT');

let allVideos = [];
let currentType = 'ALL';

document.addEventListener('DOMContentLoaded', async () => {
	if (!await requirePageAuthentication()) return;
	const selectPlaylist = document.getElementById('select-playlist');
	if (selectPlaylist) {
		selectPlaylist.addEventListener('change', loadVideos);
	}
	const inputSearch = document.getElementById('input-search');
	if (inputSearch) {
		inputSearch.addEventListener('input', filterVideos);
	}
	const refreshBtn = document.getElementById('btn-refresh');
	if (refreshBtn) {
		refreshBtn.addEventListener('click', loadPlaylists);
	}
	document.querySelectorAll('.tab-btn').forEach((button) => {
		button.addEventListener('click', () => setVideoType(button.dataset.videoType || 'ALL'));
	});
	loadPlaylists();
});

async function loadPlaylists() {
	const selectEl = document.getElementById('select-playlist');
	const refreshBtn = document.getElementById('btn-refresh');

	await withButtonLoading(refreshBtn, async () => {
		try {
			const res = await callGasApi('getPlaylists');
			selectEl.innerHTML = '<option value="ALL">すべての動画</option>';
			if (res.success && res.playlists) {
				res.playlists.forEach(pl => {
					const opt = document.createElement('option');
					opt.value = pl.id;
					opt.textContent = pl.title;
					selectEl.appendChild(opt);
				});
			}
			await loadVideos();
		} catch(e) {
			showToast('再生リストの取得に失敗しました', 'error');
		}
	}, '更新中');
}

async function loadVideos() {
	const playlistId = document.getElementById('select-playlist').value;
	const listContainer = document.getElementById('video-list');

	listContainer.textContent = '';
	const loading = document.createElement('div');
	loading.className = 'video-message';
	loading.textContent = '読み込み中...';
	listContainer.appendChild(loading);

	try {
		const res = await callGasApi('getPlaylistVideos', { playlistId });
		if (res.success && res.videos) {
			allVideos = res.videos;
			filterVideos();
		} else {
			listContainer.textContent = '';
			const empty = document.createElement('div');
			empty.className = 'video-message';
			empty.textContent = '動画が見つかりませんでした';
			listContainer.appendChild(empty);
		}
	} catch(e) {
		listContainer.textContent = '';
		const error = document.createElement('div');
		error.className = 'video-message video-message-error';
		error.textContent = '動画の読み込みに失敗しました';
		listContainer.appendChild(error);
	}
}

function setVideoType(type) {
	currentType = type;
	document.getElementById('tab-all').classList.toggle('active', type === 'ALL');
	document.getElementById('tab-regular').classList.toggle('active', type === 'REGULAR');
	document.getElementById('tab-shorts').classList.toggle('active', type === 'SHORTS');
	filterVideos();
}

function filterVideos() {
	const query = document.getElementById('input-search').value.toLowerCase().trim();
	const listContainer = document.getElementById('video-list');

	let filtered = allVideos.filter(v => {
		const matchesQuery = String(v.title ?? '').toLowerCase().includes(query);
		if (!matchesQuery) return false;

		if (currentType === 'REGULAR') return !v.isShort;
		if (currentType === 'SHORTS') return v.isShort;
		return true;
	});

	if (filtered.length === 0) {
		listContainer.textContent = '';
		const empty = document.createElement('div');
		empty.className = 'video-message';
		empty.textContent = '該当する動画がありません';
		listContainer.appendChild(empty);
		return;
	}

	listContainer.textContent = '';
	filtered.forEach((v) => {
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
}
