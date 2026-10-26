/**
 * Higopelive! 申請フォーム (src/js/live.js)
 */

initCommonLayout('live');

const PA_PARTS = ['1st', '2nd', '3rd', '4th','lead', 'bass', 'perc.'];
const LIGHT_TEMPOS = ['アップテンポ', 'ミドルテンポ', 'スローテンポ'];
const LIGHT_COLORS = ['白', '赤', '青', '黄', '緑', '紫', 'ピンク', 'オレンジ'];
const MAX_PA_MEMBERS = 7;
const MAX_LIGHT_SONGS = 10;

let liveDragSrcRow = null;

document.addEventListener('DOMContentLoaded', async () => {
	if (!await requirePageAuthentication()) return;
	addPaMemberRow();
	addPaMemberRow();
	addLightSongRow();
	bindLiveFormEvents();
	loadLiveOptions();
});

function bindLiveFormEvents() {
	document.getElementById('btn-add-pa-member').addEventListener('click', () => addPaMemberRow());
	document.getElementById('btn-add-light-song').addEventListener('click', () => addLightSongRow());
	document.getElementById('form-live-application').addEventListener('submit', handleSubmitLiveApplication);
}

async function loadLiveOptions() {
	const select = document.getElementById('live-select');
	try {
		const res = await callGasApi('getLives');
		select.textContent = '';
		if (!res.success || !res.lives || res.lives.length === 0) {
			const option = document.createElement('option');
			option.value = '';
			option.textContent = '申請受付中のライブがありません';
			select.appendChild(option);
			select.disabled = true;
			return;
		}
		res.lives.forEach((live) => {
			const option = document.createElement('option');
			option.value = live.liveId;
			option.textContent = `${live.title}（${live.date}）`;
			select.appendChild(option);
		});
	} catch (e) {
		select.textContent = '';
		const option = document.createElement('option');
		option.value = '';
		option.textContent = 'ライブ情報を取得できませんでした';
		select.appendChild(option);
	}
}

function createRowButton(text, className, title) {
	const btn = document.createElement('button');
	btn.type = 'button';
	btn.className = className;
	btn.textContent = text;
	if (title) btn.title = title;
	return btn;
}

function moveLiveRow(row, direction) {
	if (direction < 0 && row.previousElementSibling) {
		row.parentNode.insertBefore(row, row.previousElementSibling);
	} else if (direction > 0 && row.nextElementSibling) {
		row.parentNode.insertBefore(row.nextElementSibling, row);
	}
}

function attachRowDrag(row) {
	row.addEventListener('dragstart', () => {
		liveDragSrcRow = row;
		row.classList.add('is-dragging');
	});
	row.addEventListener('dragend', () => {
		liveDragSrcRow = null;
		row.classList.remove('is-dragging');
	});
	row.addEventListener('dragover', (e) => e.preventDefault());
	row.addEventListener('drop', (e) => {
		e.preventDefault();
		if (!liveDragSrcRow || liveDragSrcRow === row) return;
		const list = row.parentNode;
		const rows = Array.from(list.children);
		const srcIndex = rows.indexOf(liveDragSrcRow);
		const targetIndex = rows.indexOf(row);
		if (srcIndex < targetIndex) list.insertBefore(liveDragSrcRow, row.nextSibling);
		else list.insertBefore(liveDragSrcRow, row);
	});
}

function addPaMemberRow() {
	const list = document.getElementById('pa-member-list');
	if (list.children.length >= MAX_PA_MEMBERS) {
		showToast(`演者は${MAX_PA_MEMBERS}人までです`, 'error');
		return;
	}
	const row = document.createElement('div');
	row.className = 'live-member-row';
	row.draggable = true;
	attachRowDrag(row);

	const handle = document.createElement('span');
	handle.className = 'live-drag-handle';
	handle.textContent = '⠿';

	const nameInput = document.createElement('input');
	nameInput.type = 'text';
	nameInput.className = 'live-input live-member-name';
	nameInput.placeholder = '名前';
	nameInput.maxLength = 100;

	const partSelect = document.createElement('select');
	partSelect.className = 'live-input live-member-part';
	PA_PARTS.forEach((part) => {
		const option = document.createElement('option');
		option.value = part;
		option.textContent = part;
		partSelect.appendChild(option);
	});

	const upBtn = createRowButton('↑', 'btn small-action-button', '上へ');
	upBtn.addEventListener('click', () => moveLiveRow(row, -1));
	const downBtn = createRowButton('↓', 'btn small-action-button', '下へ');
	downBtn.addEventListener('click', () => moveLiveRow(row, 1));
	const removeBtn = createRowButton('×', 'btn btn-danger small-action-button', 'この演者を削除');
	removeBtn.addEventListener('click', () => row.remove());

	row.append(handle, nameInput, partSelect, upBtn, downBtn, removeBtn);
	list.appendChild(row);
}

function addLightSongRow() {
	const list = document.getElementById('light-song-list');
	if (list.children.length >= MAX_LIGHT_SONGS) {
		showToast(`曲は${MAX_LIGHT_SONGS}曲までです`, 'error');
		return;
	}
	const row = document.createElement('div');
	row.className = 'live-song-row';

	const titleInput = document.createElement('input');
	titleInput.type = 'text';
	titleInput.className = 'live-input live-song-title';
	titleInput.placeholder = '曲名';
	titleInput.maxLength = 100;

	const tempoSelect = document.createElement('select');
	tempoSelect.className = 'live-input live-song-tempo';
	LIGHT_TEMPOS.forEach((tempo) => {
		const option = document.createElement('option');
		option.value = tempo;
		option.textContent = tempo;
		tempoSelect.appendChild(option);
	});

	const colorSelect = document.createElement('select');
	colorSelect.className = 'live-input live-song-color';
	LIGHT_COLORS.forEach((color) => {
		const option = document.createElement('option');
		option.value = color;
		option.textContent = color;
		colorSelect.appendChild(option);
	});

	const genreInput = document.createElement('input');
	genreInput.type = 'text';
	genreInput.className = 'live-input live-song-genre';
	genreInput.placeholder = 'ジャンル（任意）';
	genreInput.maxLength = 50;

	const removeBtn = createRowButton('×', 'btn btn-danger small-action-button', 'この曲を削除');
	removeBtn.addEventListener('click', () => {
		if (list.children.length > 1) row.remove();
	});

	row.append(titleInput, tempoSelect, colorSelect, genreInput, removeBtn);
	list.appendChild(row);
}

async function handleSubmitLiveApplication(e) {
	e.preventDefault();
	const liveId = document.getElementById('live-select').value;
	const groupName = document.getElementById('live-group-name').value.trim();
	const representative = document.getElementById('live-representative').value.trim();

	const members = [];
	document.querySelectorAll('#pa-member-list .live-member-row').forEach((row) => {
		const name = row.querySelector('.live-member-name').value.trim();
		const part = row.querySelector('.live-member-part').value;
		if (name) members.push({ name, part });
	});

	const songs = [];
	document.querySelectorAll('#light-song-list .live-song-row').forEach((row) => {
		const title = row.querySelector('.live-song-title').value.trim();
		if (!title) return;
		songs.push({
			title: title,
			tempo: row.querySelector('.live-song-tempo').value,
			color: row.querySelector('.live-song-color').value,
			genre: row.querySelector('.live-song-genre').value.trim()
		});
	});

	if (!liveId) { showToast('対象ライブを選択してください', 'error'); return; }
	if (!groupName || !representative) { showToast('グループ名と代表者を入力してください', 'error'); return; }
	if (members.length === 0) { showToast('演者を1人以上入力してください', 'error'); return; }
	if (songs.length === 0) { showToast('曲を1曲以上入力してください', 'error'); return; }

	const payload = {
		liveId: liveId,
		groupName: groupName,
		representative: representative,
		pa: {
			members: members,
			micBring: document.getElementById('pa-mic-bring').value.trim(),
			notes: document.getElementById('pa-notes').value.trim()
		},
		lighting: {
			songs: songs,
			hasMc: document.getElementById('light-has-mc').value === 'true',
			mcSe: document.getElementById('light-mc-se').value === 'true',
			notes: document.getElementById('light-notes').value.trim()
		}
	};

	const btn = document.getElementById('btn-submit-live-application');
	await withButtonLoading(btn, async () => {
		const res = await callGasApi('submitApplication', payload);
		if (res.success) {
			showToast('申請しました');
			document.getElementById('form-live-application').reset();
			document.getElementById('pa-member-list').textContent = '';
			document.getElementById('light-song-list').textContent = '';
			addPaMemberRow();
			addPaMemberRow();
			addLightSongRow();
			loadLiveOptions();
		} else {
			showToast(res.error || '申請に失敗しました', 'error');
		}
	}, '送信中...');
}
