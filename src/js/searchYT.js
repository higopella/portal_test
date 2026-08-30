initCommonLayout('searchYT');

let allVideos = [];
let currentType = 'ALL';

document.addEventListener('DOMContentLoaded', () => {
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

	listContainer.innerHTML = '<div class="video-message">読み込み中...</div>';

	try {
		const res = await callGasApi('getPlaylistVideos', { playlistId });
		if (res.success && res.videos) {
			allVideos = res.videos;
			filterVideos();
		} else {
			listContainer.innerHTML = '<div class="video-message">動画が見つかりませんでした</div>';
		}
	} catch(e) {
		listContainer.innerHTML = '<div class="video-message video-message-error">動画の読み込みに失敗しました</div>';
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
		const matchesQuery = v.title.toLowerCase().includes(query);
		if (!matchesQuery) return false;

		if (currentType === 'REGULAR') return !v.isShort;
		if (currentType === 'SHORTS') return v.isShort;
		return true;
	});

	if (filtered.length === 0) {
		listContainer.innerHTML = '<div class="video-message">該当する動画がありません</div>';
		return;
	}

	listContainer.innerHTML = filtered.map(v => {
		const dateStr = v.publishedAt ? v.publishedAt.split('T')[0] : '';
		const youtubeUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(v.videoId)}`;

		return `
			<a href="${youtubeUrl}" target="_blank" rel="noopener noreferrer" class="video-card">
				<img src="${escapeHtml(v.thumbnail)}" alt="${escapeHtml(v.title)}" class="video-thumb" loading="lazy">
				<div class="video-info">
					<span class="video-title">${escapeHtml(v.title)}</span>
					<span class="video-date">${escapeHtml(dateStr)}</span>
				</div>
			</a>
		`;
	}).join('');
}
