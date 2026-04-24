import { MEMBERS } from './constants.js';
import { getWeekId, getWeekDates, getWeekLabel, shiftWeek } from './utils.js';
import { watchWeekStatus, getMemberProfiles, saveMemberProfile } from './data.js';

const params    = new URLSearchParams(location.search);
const weekId    = params.get('week') || getWeekId();
const weekDates = getWeekDates(weekId);

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
let editingId = null;

// --- Modal ---
const modal         = document.getElementById('nicknameModal');
const nicknameInput = document.getElementById('nicknameInput');
const modalSave     = document.getElementById('modalSave');
const modalCancel   = document.getElementById('modalCancel');

function openModal(memberId) {
  editingId = memberId;
  const member = MEMBERS.find(m => m.id === memberId);
  nicknameInput.value = profiles[memberId]?.displayName ?? member.name;
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
  await saveMemberProfile(editingId, newName);
  profiles[editingId] = { ...profiles[editingId], displayName: newName };
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

    const item = document.createElement('div');
    item.className = 'member-item';

    const a = document.createElement('a');
    a.className = 'member-btn' + (isFilled ? ' filled' : '');
    a.href = `fill.html?member=${encodeURIComponent(m.id)}&week=${weekId}`;
    a.innerHTML = `
      <span class="member-btn__name">${displayName(m)}</span>
      ${m.role ? `<span class="member-btn__role">${m.role}</span>` : ''}
      ${isFilled ? '<span class="member-btn__badge">✅</span>' : ''}
    `;

    const editBtn = document.createElement('button');
    editBtn.className = 'member-edit-btn';
    editBtn.title = '更改暱稱';
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

// --- Init ---
grid.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';

getMemberProfiles().then(p => {
  profiles = p;
  watchWeekStatus(weekId, updateStatus);
});
