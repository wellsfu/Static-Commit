import { MEMBERS } from './constants.js';
import { getWeekId, getWeekDates, getWeekLabel } from './utils.js';
import { watchWeekStatus } from './data.js';

const weekId    = getWeekId();
const weekDates = getWeekDates(weekId);

document.getElementById('weekLabel').textContent = getWeekLabel(weekDates);

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

renderMembers(new Set());
watchWeekStatus(weekId, updateStatus);
