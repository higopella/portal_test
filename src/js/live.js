/**
 * Higopelive! 申請フォーム (src/js/live.js)
 */

initCommonLayout('live');

const PA_PARTS = ['1st', '2nd', '3rd', '4th','lead', 'bass', 'perc.'];
const LIGHT_TEMPOS = ['アップテンポ', 'ミドルテンポ', 'スローテンポ'];
const LIGHT_COLORS = ['白', '赤', '青', '黄', '緑', '紫', 'ピンク', 'オレンジ'];
const MAX_PA_MEMBERS = 7;
const MAX_SONGS = 10;

let liveDragSrcRow = null;

document.addEventListener('DOMContentLoaded', async () => {
	if (!await requirePageAuthentication()) return;
	addPaMemberRow();
	addPaMemberRow();
	addSongTitleRow();
	bindLiveFormEvents();
	loadLiveOptions();
});

function bindLiveFormEvents() {
	document.getElementById('btn-add-pa-member').addEventListener('click', () => addPaMemberRow());
	document.getElementById('btn-add-song').addEventListener('click', () => addSongTitleRow());
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
		renumberPaMembers();
	});
}

function addPaMemberRow() {
	const list = document.getElementById('pa-member-list');
	if (list.children.length >= MAX_PA_MEMBERS) {
		showToast(`演者は${MAX_PA_MEMBERS}人までです`, 'error');
		return;
	}
	const col = document.createElement('div');
	col.className = 'live-member-col';
	col.draggable = true;
	attachRowDrag(col);

	const order = document.createElement('div');
	order.className = 'live-member-order';

	const partSelect = document.createElement('select');
	partSelect.className = 'live-input live-member-part';
	PA_PARTS.forEach((part) => {
		const option = document.createElement('option');
		option.value = part;
		option.textContent = part;
		partSelect.appendChild(option);
	});

	const nameInput = document.createElement('input');
	nameInput.type = 'text';
	nameInput.className = 'live-input live-member-name';
	nameInput.placeholder = '名前';
	nameInput.maxLength = 100;

	const actions = document.createElement('div');
	actions.className = 'live-member-actions';
	const leftBtn = createRowButton('←', 'btn small-action-button', '左へ（下手側）');
	leftBtn.addEventListener('click', () => { moveLiveRow(col, -1); renumberPaMembers(); });
	const rightBtn = createRowButton('→', 'btn small-action-button', '右へ（上手側）');
	rightBtn.addEventListener('click', () => { moveLiveRow(col, 1); renumberPaMembers(); });
	const removeBtn = createRowButton('×', 'btn btn-danger small-action-button', 'この演者を削除');
	removeBtn.addEventListener('click', () => { col.remove(); renumberPaMembers(); });
	actions.append(leftBtn, rightBtn, removeBtn);

	col.append(order, partSelect, nameInput, actions);
	list.appendChild(col);
	renumberPaMembers();
}

function renumberPaMembers() {
	document.querySelectorAll('#pa-member-list .live-member-col').forEach((col, index) => {
		col.querySelector('.live-member-order').textContent = `${index + 1}（下手→上手）`;
	});
}

function addSongTitleRow(title = '') {
	const list = document.getElementById('song-title-list');
	if (list.children.length >= MAX_SONGS) {
		showToast(`曲は${MAX_SONGS}曲までです`, 'error');
		return;
	}
	const row = document.createElement('div');
	row.className = 'live-song-row';
	const input = document.createElement('input');
	input.type = 'text';
	input.className = 'live-input song-title-input';
	input.placeholder = `曲名（${list.children.length + 1}曲目）`;
	input.maxLength = 100;
	input.value = title;
	input.addEventListener('input', syncSongSections);
	const removeBtn = createRowButton('×', 'btn btn-danger small-action-button', 'この曲を削除');
	removeBtn.addEventListener('click', () => {
		if (list.children.length > 1) {
			row.remove();
			syncSongSections();
		}
	});
	row.append(input, removeBtn);
	list.appendChild(row);
	syncSongSections();
}

function getSongTitles() {
	const titles = [];
	document.querySelectorAll('#song-title-list .song-title-input').forEach((input) => {
		const value = input.value.trim();
		if (value) titles.push(value);
	});
	return titles;
}

function syncSongSections() {
	const titles = getSongTitles();
	syncPaSongNotes(titles);
	syncLightSongDetails(titles);
}

function syncPaSongNotes(titles) {
	const container = document.getElementById('pa-song-notes');
	const existing = Array.from(container.querySelectorAll('textarea')).map((t) => t.value);
	container.textContent = '';
	titles.forEach((title, index) => {
		const group = document.createElement('div');
		group.className = 'live-form-group';
		const label = document.createElement('label');
		label.className = 'live-label';
		label.textContent = `${index + 1}曲目（${title}）のPA要望`;
		const textarea = document.createElement('textarea');
		textarea.className = 'live-textarea pa-song-note';
		textarea.rows = 2;
		textarea.maxLength = 1000;
		textarea.value = existing[index] || '';
		group.append(label, textarea);
		container.appendChild(group);
	});
}

function createLightSongDetail(index, title, values) {
	const group = document.createElement('div');
	group.className = 'live-form-group live-song-detail';
	const label = document.createElement('label');
	label.className = 'live-label';
	label.textContent = `${index + 1}曲目（${title}）`;

	const row = document.createElement('div');
	row.className = 'live-song-row';
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
	row.append(tempoSelect, colorSelect, genreInput);

	const notes = document.createElement('textarea');
	notes.className = 'live-textarea live-song-notes';
	notes.rows = 2;
	notes.maxLength = 1000;
	notes.placeholder = 'この曲の照明要望（任意）';

	if (values) {
		tempoSelect.value = values.tempo;
		colorSelect.value = values.color;
		genreInput.value = values.genre;
		notes.value = values.notes;
	}

	group.append(label, row, notes);
	return group;
}

function syncLightSongDetails(titles) {
	const container = document.getElementById('light-song-detail-list');
	const existing = Array.from(container.querySelectorAll('.live-song-detail')).map((detail) => ({
		tempo: detail.querySelector('.live-song-tempo').value,
		color: detail.querySelector('.live-song-color').value,
		genre: detail.querySelector('.live-song-genre').value,
		notes: detail.querySelector('.live-song-notes').value
	}));
	container.textContent = '';
	titles.forEach((title, index) => {
		container.appendChild(createLightSongDetail(index, title, existing[index]));
	});
}

async function handleSubmitLiveApplication(e) {
	e.preventDefault();
	const liveId = document.getElementById('live-select').value;
	const groupName = document.getElementById('live-group-name').value.trim();
	const representative = document.getElementById('live-representative').value.trim();

	const members = [];
	document.querySelectorAll('#pa-member-list .live-member-col').forEach((row) => {
		const name = row.querySelector('.live-member-name').value.trim();
		const part = row.querySelector('.live-member-part').value;
		if (name) members.push({ name, part });
	});

	const songTitles = getSongTitles();
	const paSongNotes = [];
	Array.from(document.querySelectorAll('#pa-song-notes .pa-song-note')).forEach((textarea, index) => {
		paSongNotes.push({ title: songTitles[index], notes: textarea.value.trim() });
	});
	const songDetails = [];
	Array.from(document.querySelectorAll('#light-song-detail-list .live-song-detail')).forEach((detail, index) => {
		songDetails.push({
			title: songTitles[index],
			tempo: detail.querySelector('.live-song-tempo').value,
			color: detail.querySelector('.live-song-color').value,
			genre: detail.querySelector('.live-song-genre').value.trim(),
			notes: detail.querySelector('.live-song-notes').value.trim()
		});
	});

	if (!liveId) { showToast('対象ライブを選択してください', 'error'); return; }
	if (!groupName || !representative) { showToast('グループ名と代表者を入力してください', 'error'); return; }
	if (members.length === 0) { showToast('演者を1人以上入力してください', 'error'); return; }
	if (songTitles.length === 0) { showToast('演奏曲を1曲以上入力してください', 'error'); return; }

	const payload = {
		liveId: liveId,
		groupName: groupName,
		representative: representative,
		pa: {
			members: members,
			micBring: document.getElementById('pa-mic-bring').value.trim(),
			notes: document.getElementById('pa-notes').value.trim(),
			songNotes: paSongNotes
		},
		lighting: {
			hasMc: document.getElementById('light-has-mc').value === 'true',
			mcSe: document.getElementById('light-mc-se').value === 'true',
			notes: document.getElementById('light-notes').value.trim(),
			songDetails: songDetails
		}
	};

	const btn = document.getElementById('btn-submit-live-application');
	await withButtonLoading(btn, async () => {
		const res = await callGasApi('submitApplication', payload);
		if (res.success) {
			showToast('申請しました');
			document.getElementById('form-live-application').reset();
			document.getElementById('pa-member-list').textContent = '';
			document.getElementById('song-title-list').textContent = '';
			addPaMemberRow();
			addPaMemberRow();
			addSongTitleRow();
			loadLiveOptions();
		} else {
			showToast(res.error || '申請に失敗しました', 'error');
		}
	}, '送信中...');
}
