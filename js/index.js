import { MEMBERS } from './constants.js';
import { getWeekId, getWeekDates, getWeekLabel, shiftWeek } from './utils.js';
import { watchWeekStatus } from './data.js';

const params  = new URLSearchParams(location.search);
const weekId  = params.get('week') || getWeekId();
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

function renderMembers(filledSet) {
  grid.innerHTML = '';
  MEMBERS.forEach(m => {
    const isFilled = filledSet.has(m.id);
    const a = document.createElement('a');
    a.className = 'member-btn' + (isFilled ? ' filled' : '');
    a.href = `fill.html?member=${encodeURIComponent(m.id)}&week=${weekId}`;

    a.innerHTML = `
      <span class="member-btn__name">${m.name}</span>
      ${m.role ? `<span class="member-btn__role">${m.role}</span>` : ''}
      ${isFilled ? '<span class="member-btn__badge">✅</span>' : ''}
    `;
    grid.appendChild(a);
  });
}

function updateStatus(filledIds) {
  const filledSet = new Set(filledIds);
  renderMembers(filledSet);

  const count = filledIds.length;
  const total = MEMBERS.length;
  document.getElementById('fillCount').textContent = `${count} / ${total} 人`;
  document.getElementById('progressFill').style.width = `${(count / total) * 100}%`;

  const missing = MEMBERS.filter(m => !filledSet.has(m.id)).map(m => m.name);
  const missingEl = document.getElementById('missingMembers');
  missingEl.textContent = missing.length > 0 ? `未填：${missing.join('、')}` : '全員已填寫 🎉';
}

grid.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';
watchWeekStatus(weekId, updateStatus);
