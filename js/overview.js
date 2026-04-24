import { MEMBERS } from './constants.js';
import {
  getWeekId, getWeekDates, getWeekLabel, formatDateISO, timeToMinutes, shiftWeek
} from './utils.js';
import { getFullWeekData, watchWeekStatus } from './data.js';

const params    = new URLSearchParams(location.search);
const weekId    = params.get('week') || getWeekId();
const weekDates = getWeekDates(weekId);

const DAY_NAMES   = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
const TIME_START  = 13 * 60;
const TIME_END    = 27 * 60;
const CELL_MIN    = 30;
const COLS        = (TIME_END - TIME_START) / CELL_MIN; // 28 cells

function weekBadge(id) {
  const cur  = getWeekId();
  if (id === cur)                return '本週　';
  if (id === shiftWeek(cur,  1)) return '下週　';
  if (id === shiftWeek(cur, -1)) return '上週　';
  return '';
}

document.getElementById('overviewWeekLabel').textContent =
  weekBadge(weekId) + getWeekLabel(weekDates);

document.getElementById('backLink').href = `index.html?week=${weekId}`;

document.getElementById('prevWeek').addEventListener('click', () => {
  location.href = `overview.html?week=${shiftWeek(weekId, -1)}`;
});
document.getElementById('nextWeek').addEventListener('click', () => {
  location.href = `overview.html?week=${shiftWeek(weekId, 1)}`;
});

watchWeekStatus(weekId, filledIds => {
  const filledSet = new Set(filledIds);
  const missing = MEMBERS.filter(m => !filledSet.has(m.id)).map(m => m.name);
  document.getElementById('overviewFillCount').textContent =
    `已填：${filledIds.length} / ${MEMBERS.length}`;
  document.getElementById('overviewMissing').textContent =
    missing.length > 0 ? `未填：${missing.join('、')}` : '';
});

function heatColor(count) {
  if (count === 0) return 'var(--heat-0)';
  if (count <= 2)  return 'var(--heat-1)';
  if (count <= 4)  return 'var(--heat-2)';
  if (count <= 6)  return 'var(--heat-3)';
  return 'var(--heat-4)';
}

function countAvailableAt(fullData, dateStr, minutePoint) {
  let count = 0;
  for (const m of MEMBERS) {
    const dayData = fullData[m.id]?.[dateStr];
    if (!dayData || dayData.unavailable) continue;
    for (const slot of (dayData.slots || [])) {
      if (minutePoint >= timeToMinutes(slot.start) && minutePoint < timeToMinutes(slot.end)) {
        count++;
        break;
      }
    }
  }
  return count;
}

function getMembersAt(fullData, dateStr, minutePoint) {
  return MEMBERS.map(m => {
    const dayData = fullData[m.id]?.[dateStr];
    if (!dayData) return { member: m, status: 'unfilled' };
    if (dayData.unavailable) return { member: m, status: 'unavailable' };
    const available = (dayData.slots || []).some(slot =>
      minutePoint >= timeToMinutes(slot.start) && minutePoint < timeToMinutes(slot.end)
    );
    return { member: m, status: available ? 'available' : 'busy' };
  });
}

function minutesToDisplay(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

let activeCell = null;

function renderHeatmap(fullData) {
  const wrapper = document.getElementById('heatmapWrapper');
  wrapper.innerHTML = '';

  // Time header row
  const timeRow = document.createElement('div');
  timeRow.className = 'heatmap-time-row';
  for (let i = 0; i < COLS; i++) {
    const t = TIME_START + i * CELL_MIN;
    const label = document.createElement('div');
    label.className = 'heatmap-time-label';
    label.textContent = i % 2 === 0 ? minutesToDisplay(t) : '';
    timeRow.appendChild(label);
  }
  wrapper.appendChild(timeRow);

  weekDates.forEach((date, rowIdx) => {
    const ds = formatDateISO(date);
    const row = document.createElement('div');
    row.className = 'heatmap-row';

    const dayLabel = document.createElement('div');
    dayLabel.className = 'heatmap-day-label';
    dayLabel.textContent = DAY_NAMES[rowIdx];
    row.appendChild(dayLabel);

    for (let col = 0; col < COLS; col++) {
      const t = TIME_START + col * CELL_MIN;
      const count = countAvailableAt(fullData, ds, t);
      const cell = document.createElement('div');
      cell.className = 'heatmap-cell';
      cell.style.background = heatColor(count);
      cell.dataset.date = ds;
      cell.dataset.time = t;
      cell.title = `${DAY_NAMES[rowIdx]} ${minutesToDisplay(t)} – ${count}人有空`;

      cell.addEventListener('click', () => {
        if (activeCell === cell) {
          activeCell.classList.remove('active');
          activeCell = null;
          hideDetail();
          return;
        }
        if (activeCell) activeCell.classList.remove('active');
        activeCell = cell;
        cell.classList.add('active');
        showDetail(fullData, ds, t, rowIdx);
      });

      row.appendChild(cell);
    }
    wrapper.appendChild(row);
  });

  // Legend
  const legend = document.createElement('div');
  legend.className = 'heatmap-legend';
  [
    { color: 'var(--heat-4)', label: '7–8人' },
    { color: 'var(--heat-3)', label: '5–6人' },
    { color: 'var(--heat-2)', label: '3–4人' },
    { color: 'var(--heat-1)', label: '1–2人' },
    { color: 'var(--heat-0)', label: '0人' },
  ].forEach(({ color, label }) => {
    legend.innerHTML += `
      <div class="heatmap-legend-item">
        <div class="heatmap-legend-swatch" style="background:${color}"></div>
        <span>${label}</span>
      </div>`;
  });
  wrapper.appendChild(legend);
}

function showDetail(fullData, ds, minutePoint, rowIdx) {
  const panel = document.getElementById('detailPanel');
  panel.classList.remove('hidden');
  panel.classList.add('visible');

  const endMin = minutePoint + CELL_MIN;
  document.getElementById('detailHeader').textContent =
    `${DAY_NAMES[rowIdx]} ${minutesToDisplay(minutePoint)}–${minutesToDisplay(endMin)}`;

  const membersStatus = getMembersAt(fullData, ds, minutePoint);
  const availCount = membersStatus.filter(ms => ms.status === 'available').length;
  document.getElementById('detailSubhead').textContent = `${availCount} 人有空`;

  const membersEl = document.getElementById('detailMembers');
  membersEl.innerHTML = membersStatus.map(ms => {
    const icon = ms.status === 'available' ? '✅'
                : ms.status === 'unavailable' ? '❌'
                : '⬜';
    const note = ms.status === 'unfilled' ? '（未填寫）' : '';
    return `<span class="detail-member">${icon} ${ms.member.name}${note}</span>`;
  }).join('');
}

function hideDetail() {
  const panel = document.getElementById('detailPanel');
  panel.classList.remove('visible');
  panel.classList.add('hidden');
}

async function init() {
  const wrapper = document.getElementById('heatmapWrapper');
  wrapper.innerHTML = '<div class="loading-center"><div class="spinner spinner--lg"></div><span>載入中…</span></div>';
  try {
    const fullData = await getFullWeekData(weekId);
    const hasData = Object.keys(fullData).length > 0;
    if (!hasData) {
      wrapper.innerHTML = '<p class="empty-hint">本週尚無人填寫</p>';
      return;
    }
    renderHeatmap(fullData);
  } catch (e) {
    console.error(e);
    wrapper.innerHTML = '<p class="empty-hint">載入失敗，請重新整理頁面</p>';
  }
}

init();
