import { MEMBERS } from './constants.js';
import { getWeekId, getWeekDates, getWeekLabel, shiftWeek } from './utils.js';
import { watchWeekStatus, getMemberProfiles, saveMemberProfile, addLog, getWeekLogs } from './data.js';

const params    = new URLSearchParams(location.search);
const weekId    = params.get('week') || getWeekId();
const weekDates = getWeekDates(weekId);

const FF14_JOBS = [
  '騎士', '戰士', '暗騎', '絕槍',
  '白魔', '學者', '占星', '賢者',
  '武僧', '龍騎', '忍者', '武士', '鐮刀', '蝰蛇',
  '詩人', '機工', '舞者',
  '黑魔', '召喚', '赤魔', '繪靈',
];

const POSITIONS = ['T1', 'T2', 'H1', 'H2', 'D1', 'D2', 'D3', 'D4'];

function posClass(pos) {
  if (!pos) return '';
  if (pos[0] === 'T') return 'pos-tank';
  if (pos[0] === 'H') return 'pos-heal';
  return 'pos-dps';
}

function weekBadge(id) {
  const cur  = getWeekId();
  if (id === cur)                return '本週　';
  if (id === shiftWeek(cur,  1)) return '下週　';
  if (id === shiftWeek(cur, -1)) return '上週　';
  return '';
}

document.getElementById('weekLabel').textContent =
  weekBadge(weekId) + getWeekLabel(weekDates);
document.getElementById('overviewLink').href = `overview.html?week=${weekId}`;

document.getElementById('prevWeek').addEventListener('click', () => {
  location.href = `index.html?week=${shiftWeek(weekId, -1)}`;
});
document.getElementById('nextWeek').addEventListener('click', () => {
  location.href = `index.html?week=${shiftWeek(weekId, 1)}`;
});

const grid = document.getElementById('memberGrid');
let profiles = {};
let currentFilledSet = new Set();
let editingId      = null;
let selectedPosition = '';
let beforeProfile  = null;

// --- Modal elements ---
const modal         = document.getElementById('nicknameModal');
const modalTitle    = document.getElementById('modalTitle');
const nicknameInput = document.getElementById('nicknameInput');
const jobInput      = document.getElementById('jobInput');
const positionGrid  = document.getElementById('positionGrid');
const modalSave     = document.getElementById('modalSave');
const modalCancel   = document.getElementById('modalCancel');

// Populate job datalist
const jobDatalist = document.getElementById('ff14JobList');
FF14_JOBS.forEach(job => {
  const opt = document.createElement('option');
  opt.value = job;
  jobDatalist.appendChild(opt);
});

// Build position chips
POSITIONS.forEach(pos => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `pos-chip ${posClass(pos)}`;
  btn.dataset.pos = pos;
  btn.textContent = pos;
  btn.addEventListener('click', () => {
    selectedPosition = selectedPosition === pos ? '' : pos;
    updatePositionChips();
  });
  positionGrid.appendChild(btn);
});

function updatePositionChips() {
  positionGrid.querySelectorAll('.pos-chip').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.pos === selectedPosition);
  });
}

// --- Modal open/close ---
function openModal(memberId) {
  editingId = memberId;
  const member   = MEMBERS.find(m => m.id === memberId);
  const profile  = profiles[memberId] ?? {};
  const name     = profile.displayName ?? member.name;

  modalTitle.textContent = `更改 ${name} 的資料`;
  nicknameInput.value = name;
  jobInput.value      = profile.job ?? member.role ?? '';
  selectedPosition    = profile.position ?? '';
  updatePositionChips();

  beforeProfile = {
    displayName: name,
    job:         profile.job ?? member.role ?? '',
    position:    profile.position ?? '',
  };

  modal.classList.remove('hidden');
  nicknameInput.focus();
  nicknameInput.select();
}

function closeModal() {
  modal.classList.add('hidden');
  editingId = null;
}

modalCancel.addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

modalSave.addEventListener('click', async () => {
  const newName = nicknameInput.value.trim();
  if (!newName || !editingId) return;
  modalSave.disabled = true;
  const profileData = {
    displayName: newName,
    job:         jobInput.value.trim(),
    position:    selectedPosition,
  };
  await saveMemberProfile(editingId, profileData);
  if (beforeProfile) {
    const diff = {};
    if (profileData.displayName !== beforeProfile.displayName)
      diff.displayName = { from: beforeProfile.displayName, to: profileData.displayName };
    if (profileData.job !== beforeProfile.job)
      diff.job = { from: beforeProfile.job, to: profileData.job };
    if (profileData.position !== beforeProfile.position)
      diff.position = { from: beforeProfile.position, to: profileData.position };
    if (Object.keys(diff).length > 0) {
      addLog(weekId, { action: 'profile_update', memberId: editingId, diff })
        .catch(e => console.warn('Log write failed:', e));
    }
  }
  profiles[editingId] = { ...profiles[editingId], ...profileData };
  modalSave.disabled = false;
  closeModal();
  renderMembers(currentFilledSet);
});

nicknameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter')  modalSave.click();
  if (e.key === 'Escape') closeModal();
});

// --- Render ---
function displayName(m) {
  return profiles[m.id]?.displayName ?? m.name;
}

function renderMembers(filledSet) {
  currentFilledSet = filledSet;
  grid.innerHTML = '';
  MEMBERS.forEach(m => {
    const isFilled = filledSet.has(m.id);
    const profile  = profiles[m.id] ?? {};
    const pos      = profile.position ?? '';
    const job      = profile.job ?? m.role ?? '';

    const item = document.createElement('div');
    item.className = 'member-item';

    const a = document.createElement('a');
    a.className = 'member-btn' + (isFilled ? ' filled' : '');
    a.href = `fill.html?member=${encodeURIComponent(m.id)}&week=${weekId}`;
    a.innerHTML = `
      ${pos ? `<span class="member-pos-badge ${posClass(pos)}">${pos}</span>` : ''}
      <span class="member-btn__name">${displayName(m)}</span>
      ${job ? `<span class="member-btn__role">${job}</span>` : ''}
      ${isFilled ? '<span class="member-btn__badge">✅</span>' : ''}
    `;

    const editBtn = document.createElement('button');
    editBtn.className = 'member-edit-btn';
    editBtn.title = '更改資料';
    editBtn.textContent = '✏';
    editBtn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      openModal(m.id);
    });

    item.appendChild(a);
    item.appendChild(editBtn);
    grid.appendChild(item);
  });
}

function updateStatus(filledIds) {
  const filledSet = new Set(filledIds);
  renderMembers(filledSet);

  const count = filledIds.length;
  const total = MEMBERS.length;
  document.getElementById('fillCount').textContent = `${count} / ${total} 人`;
  document.getElementById('progressFill').style.width = `${(count / total) * 100}%`;

  const missing = MEMBERS
    .filter(m => !filledSet.has(m.id))
    .map(m => displayName(m));
  const missingEl = document.getElementById('missingMembers');
  missingEl.textContent = missing.length > 0 ? `未填：${missing.join('、')}` : '全員已填寫 🎉';
}

// --- Log modal ---
document.getElementById('logBtn').addEventListener('click', openLogModal);
document.getElementById('logModalClose').addEventListener('click', closeLogModal);
document.getElementById('logModal').addEventListener('click', e => {
  if (e.target.id === 'logModal') closeLogModal();
});

async function openLogModal() {
  document.getElementById('logModal').classList.remove('hidden');
  const logList = document.getElementById('logList');
  logList.innerHTML = '<div class="log-empty">載入中…</div>';
  try {
    const logs = await getWeekLogs(weekId);
    renderLogs(logs, logList);
  } catch (e) {
    logList.innerHTML = '<div class="log-empty">載入失敗</div>';
  }
}

function closeLogModal() {
  document.getElementById('logModal').classList.add('hidden');
}

function renderLogs(logs, container) {
  if (logs.length === 0) {
    container.innerHTML = '<div class="log-empty">本週尚無修改紀錄</div>';
    return;
  }
  container.innerHTML = '';
  logs.forEach(log => {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const ts = log.timestamp?.toDate?.() ?? null;
    const timeStr = ts ? formatLogTime(ts) : '—';
    const actorName = profiles[log.memberId]?.displayName ?? log.memberId;
    const actionLabel = log.action === 'availability_submit' ? '送出可用時間' : '更改個人資料';
    let copyNote = '';
    if (log.copySource) {
      const srcName = profiles[log.copySource]?.displayName ?? log.copySource;
      copyNote = `（套用自 ${srcName}）`;
    }
    entry.innerHTML = `
      <div class="log-entry__header">
        <span class="log-entry__actor">${actorName}</span>
        <span class="log-entry__time">${timeStr}</span>
      </div>
      <div class="log-entry__action">${actionLabel}${copyNote}</div>
      ${renderDiff(log.action, log.diff)}
    `;
    container.appendChild(entry);
  });
}

function formatLogTime(date) {
  const mo  = String(date.getMonth() + 1).padStart(2, '0');
  const d   = String(date.getDate()).padStart(2, '0');
  const h   = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${mo}/${d} ${h}:${min}`;
}

function renderDiff(action, diff) {
  if (!diff || Object.keys(diff).length === 0) return '';
  const lines = [];
  if (action === 'availability_submit') {
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    Object.keys(diff).sort().forEach(date => {
      const { from, to } = diff[date];
      const d = new Date(date + 'T00:00:00');
      lines.push(`<span class="log-diff__date">${date.slice(5)}（週${dayNames[d.getDay()]}）</span>`);
      lines.push(`<span class="log-diff__removed">- ${formatDayState(from)}</span>`);
      lines.push(`<span class="log-diff__added">+ ${formatDayState(to)}</span>`);
    });
  } else {
    const labels = { displayName: '暱稱', job: '職業', position: '位置' };
    Object.entries(diff).forEach(([field, { from, to }]) => {
      const label = labels[field] ?? field;
      lines.push(`<span class="log-diff__removed">- ${label}: ${from || '（空）'}</span>`);
      lines.push(`<span class="log-diff__added">+ ${label}: ${to || '（空）'}</span>`);
    });
  }
  return `<div class="log-diff">${lines.join('')}</div>`;
}

function formatDayState(s) {
  if (!s) return '（無資料）';
  if (s.unavailable) return '無法出團';
  if (!s.slots || s.slots.length === 0) return '（待定）';
  return s.slots.map(sl => `${sl.start}–${sl.end}`).join('、');
}

// --- Init ---
grid.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';

getMemberProfiles().then(p => {
  profiles = p;
  watchWeekStatus(weekId, updateStatus);
});
