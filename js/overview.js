import { MEMBERS } from './constants.js';
import {
  getWeekId, getWeekDates, getWeekLabel, formatDateISO, timeToMinutes, shiftWeek
} from './utils.js';
import { getFullWeekData, watchWeekStatus, getMemberProfiles } from './data.js';

const params    = new URLSearchParams(location.search);
const weekId    = params.get('week') || getWeekId();
const weekDates = getWeekDates(weekId);

const DAY_NAMES   = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
const TIME_START  = 10 * 60;
const TIME_END    = 27 * 60;
const CELL_MIN    = 30;
const COLS        = (TIME_END - TIME_START) / CELL_MIN; // 34 cells (10:00–27:00)

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

let memberProfiles = {};
getMemberProfiles().then(p => { memberProfiles = p; });

const enabledMembers = new Set(MEMBERS.map(m => m.id));
let cachedFullData = null;

function renderMemberFilter() {
  const container = document.getElementById('memberFilter');
  container.innerHTML = '';
  MEMBERS.forEach(m => {
    const chip = document.createElement('button');
    chip.className = 'member-chip';
    chip.appendChild(document.createTextNode(m.name));

    chip.addEventListener('click', () => {
      if (enabledMembers.has(m.id)) {
        if (enabledMembers.size === 1) return; // keep at least 1 enabled
        enabledMembers.delete(m.id);
        chip.classList.add('member-chip--off');
      } else {
        enabledMembers.add(m.id);
        chip.classList.remove('member-chip--off');
      }
      activeCell = null;
      hideDetail();
      if (cachedFullData) {
        renderHeatmap(cachedFullData);
        renderFullSlots(cachedFullData);
      }
    });

    container.appendChild(chip);
  });
}

function displayName(m) {
  return memberProfiles[m.id]?.displayName ?? m.name;
}

watchWeekStatus(weekId, members => {
  const filledSet = new Set(members.map(m => m.id));
  const missing = MEMBERS.filter(m => !filledSet.has(m.id)).map(m => displayName(m));
  document.getElementById('overviewFillCount').textContent =
    `已填：${members.length} / ${MEMBERS.length}`;
  document.getElementById('overviewMissing').textContent =
    missing.length > 0 ? `未填：${missing.join('、')}` : '';
});

function heatColor(count) {
  const total = enabledMembers.size;
  if (count === 0)       return 'var(--heat-0)';
  if (count <= 2)        return 'var(--heat-1)';
  if (count <= 4)        return 'var(--heat-2)';
  if (count <= 6)        return 'var(--heat-3)';
  if (count < total)     return 'var(--heat-4)';
  return 'var(--heat-full)';
}

function countAvailableAt(fullData, dateStr, minutePoint) {
  let count = 0;
  for (const m of MEMBERS) {
    if (!enabledMembers.has(m.id)) continue;
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
    if (rowIdx === 4) row.classList.add('heatmap-row--friday');
    if (rowIdx >= 5)  row.classList.add('heatmap-row--weekend');

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
  const total = enabledMembers.size;
  const legend = document.createElement('div');
  legend.className = 'heatmap-legend';
  [
    { color: 'var(--heat-full)', label: `全員 (${total}人)` },
    { color: 'var(--heat-4)',    label: `${total - 1}人` },
    { color: 'var(--heat-3)',    label: '5–6人' },
    { color: 'var(--heat-2)',    label: '3–4人' },
    { color: 'var(--heat-1)',    label: '1–2人' },
    { color: 'var(--heat-0)',    label: '0人' },
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
  const available = membersStatus.filter(ms => ms.status === 'available');
  const others    = membersStatus.filter(ms => ms.status !== 'available');

  const renderChips = (list) => list.map(ms => {
    const icon = ms.status === 'available' ? '✅'
                : ms.status === 'unavailable' ? '❌'
                : '⬜';
    const note = ms.status === 'unfilled' ? '（未填寫）' : '';
    return `<span class="detail-member">${icon} ${displayName(ms.member)}${note}</span>`;
  }).join('');

  membersEl.innerHTML =
    `<div class="detail-members-row">${renderChips(available)}</div>` +
    (others.length ? `<div class="detail-members-row">${renderChips(others)}</div>` : '');
}

function hideDetail() {
  const panel = document.getElementById('detailPanel');
  panel.classList.remove('visible');
  panel.classList.add('hidden');
}

function combinations(arr, k) {
  if (k === 0) return [[]];
  if (k > arr.length) return [];
  if (k === arr.length) return [arr.slice()];
  const [first, ...rest] = arr;
  return [
    ...combinations(rest, k - 1).map(c => [first, ...c]),
    ...combinations(rest, k),
  ];
}

function findSlotsForMemberIds(fullData, memberIds) {
  const slots = [];
  weekDates.forEach((date, rowIdx) => {
    const ds = formatDateISO(date);
    let rangeStart = null;
    for (let col = 0; col <= COLS; col++) {
      const t = TIME_START + col * CELL_MIN;
      const allAvail = col < COLS && memberIds.every(id => {
        const dayData = fullData[id]?.[ds];
        if (!dayData || dayData.unavailable) return false;
        return (dayData.slots || []).some(s =>
          t >= timeToMinutes(s.start) && t < timeToMinutes(s.end)
        );
      });
      if (allAvail) {
        if (rangeStart === null) rangeStart = t;
      } else if (rangeStart !== null) {
        slots.push({ dayName: DAY_NAMES[rowIdx], date: ds, start: rangeStart, end: t });
        rangeStart = null;
      }
    }
  });
  return slots;
}

function findBestCombo(fullData, count) {
  const presentMembers = MEMBERS.filter(m => enabledMembers.has(m.id));
  let bestMembers = [], bestSlots = [], bestMin = -1;
  for (const combo of combinations(presentMembers, count)) {
    const ids   = combo.map(m => m.id);
    const slots = findSlotsForMemberIds(fullData, ids);
    const mins  = slots.reduce((a, s) => a + s.end - s.start, 0);
    if (mins > bestMin) { bestMin = mins; bestMembers = combo; bestSlots = slots; }
  }
  return { members: bestMembers, slots: bestSlots };
}


function renderFullSlots(fullData) {
  const section = document.getElementById('fullSlotsSection');
  const list    = document.getElementById('fullSlotsList');

  const presentMembers = MEMBERS.filter(m => enabledMembers.has(m.id));
  const n = presentMembers.length;
  document.getElementById('fullSlotsTitle').textContent = '可出團時段';

  const tiers = [];

  // Tier 1: all present members
  const tier1Slots = findSlotsForMemberIds(fullData, presentMembers.map(m => m.id));
  if (tier1Slots.length > 0) {
    tiers.push({ label: `全員 ${n} 人`, members: null, slots: tier1Slots, t: 1 });
  }

  // Tier 2: best N-1 combo (show all slots including those overlapping tier 1)
  if (n >= 2) {
    const { members, slots } = findBestCombo(fullData, n - 1);
    if (slots.length > 0) {
      tiers.push({ label: `${n - 1}最多出團時段:`, members, slots, t: 2 });
    }
  }

  // Tier 3: best N-2 combo (show all slots including those overlapping tier 1/2)
  if (n >= 3) {
    const { members, slots } = findBestCombo(fullData, n - 2);
    if (slots.length > 0) {
      tiers.push({ label: `${n - 2}最多出團時段:`, members, slots, t: 3 });
    }
  }

  if (tiers.length === 0) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');

  list.innerHTML = tiers.map(({ label, members, slots, t }) => {
    const memberLine = members
      ? `<span class="full-slot-tier-members">${members.map(m => displayName(m)).join('、')}</span>`
      : '';
    const items = slots.map(s =>
      `<div class="full-slot-item full-slot-item--t${t}">${s.dayName}&nbsp;&nbsp;${minutesToDisplay(s.start)} – ${minutesToDisplay(s.end)}</div>`
    ).join('');
    return `<div class="full-slot-tier">
      <div class="full-slot-tier-header full-slot-tier-header--t${t}">${label}${memberLine}</div>
      ${items}
    </div>`;
  }).join('');
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
    cachedFullData = fullData;
    renderMemberFilter();
    renderHeatmap(fullData);
    renderFullSlots(fullData);
  } catch (e) {
    console.error(e);
    wrapper.innerHTML = '<p class="empty-hint">載入失敗，請重新整理頁面</p>';
  }
}

init();
