import { MEMBERS, PRESET_SLOTS, TIME_MIN, TIME_MAX, TIME_STEP } from './constants.js';
import {
  getWeekId, getWeekDates, formatDateLabel, formatDateISO,
  timeToMinutes, minutesToTime, addMinutes, formatSlotSummary
} from './utils.js';
import {
  getMemberWeekData, saveMemberWeekData, getMemberProfiles,
  getWeekFilledMembers, addLog
} from './data.js';

const params   = new URLSearchParams(location.search);
const memberId = params.get('member');
const weekId   = params.get('week') || getWeekId();

if (!memberId || !MEMBERS.find(m => m.id === memberId)) {
  location.href = 'index.html';
}

document.querySelector('.fill-nav__back').href = `index.html?week=${weekId}`;

let allProfiles = {};
getMemberProfiles().then(profiles => {
  allProfiles = profiles;
  const member = MEMBERS.find(m => m.id === memberId);
  const name = profiles[memberId]?.displayName ?? member?.name ?? memberId;
  document.getElementById('memberName').textContent = `${name} 的出團時間`;
});

const weekDates = getWeekDates(weekId);

// state[dateStr] = { unavailable: bool, slots: [{id, start, end}] }
const state = {};
weekDates.forEach(d => {
  state[formatDateISO(d)] = { unavailable: false, slots: [] };
});

let originalData = {};
let copySource   = null;

// 修仙模式：OFF → 只顯示晚間/深夜；ON → 顯示全部時段
const xianKey  = `xianMode_${memberId}`;
let   xianMode = localStorage.getItem(xianKey) === 'true';
const NIGHT_IDS = new Set(['night', 'late']);

function visibleSlots(isWeekend = false) {
  return (xianMode || isWeekend) ? PRESET_SLOTS : PRESET_SLOTS.filter(p => NIGHT_IDS.has(p.id));
}

function applyMemberData(saved) {
  weekDates.forEach(d => {
    const ds = formatDateISO(d);
    if (saved[ds]) {
      const rawSlots = saved[ds].slots || [];
      state[ds] = {
        unavailable: saved[ds].unavailable || false,
        slots: rawSlots.map(s => {
          const preset = PRESET_SLOTS.find(p => p.start === s.start && p.end === s.end);
          return { id: preset ? preset.id : 'custom_' + s.start, start: s.start, end: s.end };
        }),
      };
    } else {
      state[ds] = { unavailable: false, slots: [] };
    }
  });
}

async function init() {
  const overlay = document.getElementById('loadingOverlay');
  try {
    const saved = await getMemberWeekData(weekId, memberId);
    applyMemberData(saved);
  } catch (e) {
    // no prior data
  }

  // snapshot for diff on submit
  weekDates.forEach(d => {
    const ds = formatDateISO(d);
    originalData[ds] = {
      unavailable: state[ds].unavailable,
      slots: state[ds].slots.map(s => ({ start: s.start, end: s.end })),
    };
  });

  const xianToggle = document.getElementById('xianModeToggle');
  xianToggle.checked = xianMode;
  xianToggle.addEventListener('change', () => {
    xianMode = xianToggle.checked;
    localStorage.setItem(xianKey, xianMode);
    renderAll();
  });

  renderAll();
  overlay.classList.add('fade-out');
  setTimeout(() => overlay.remove(), 300);
}

function renderAll() {
  const container = document.getElementById('dayCardsContainer');
  container.innerHTML = '';
  weekDates.forEach((d, idx) => {
    const ds = formatDateISO(d);
    container.appendChild(buildDayCard(d, ds, idx));
  });
  updateProgressDots();
  updateSubmitWarning();
}

function buildDayCard(date, ds, dayIdx) {
  const s = state[ds];
  const article = document.createElement('article');
  article.className = 'day-card';
  if (dayIdx === 4) article.classList.add('day-card--friday');
  if (dayIdx >= 5)  article.classList.add('day-card--weekend');
  article.id = `day-${ds}`;
  article.dataset.date = ds;

  const slots = visibleSlots(dayIdx >= 5);

  article.innerHTML = `
    <div class="day-card__header">
      <h3 class="day-card__title">${formatDateLabel(date)}</h3>
      <button class="day-card__apply-btn" title="複製此天設定到所有其他天">套用到其他天</button>
    </div>
    <label class="unavailable-toggle">
      <span>無法出團</span>
      <div class="toggle-switch">
        <input type="checkbox" class="toggle-input" ${s.unavailable ? 'checked' : ''}>
        <span class="toggle-thumb"></span>
      </div>
    </label>
    <div class="slot-section collapsible ${s.unavailable ? 'hidden' : 'visible'}">
      <p class="slot-section__label">選擇時段（可多選）</p>
      <div class="preset-grid">
        ${slots.map(p => `
          <button class="preset-btn ${s.slots.find(sl => sl.id === p.id) ? 'selected' : ''}" data-slot-id="${p.id}">
            <span class="preset-btn__name">${p.label}</span>
            <span class="preset-btn__time">${p.sub}</span>
            <span class="preset-btn__check">✓</span>
          </button>
        `).join('')}
      </div>
      <div class="adj-section collapsible ${s.slots.length > 0 ? 'visible' : 'hidden'}" id="adj-${ds}"></div>
      <p class="slot-summary" id="summary-${ds}"></p>
    </div>
  `;

  article.querySelector('.day-card__apply-btn').addEventListener('click', () => applyToAll(ds));

  article.querySelector('.toggle-input').addEventListener('change', e => {
    state[ds].unavailable = e.target.checked;
    if (e.target.checked) state[ds].slots = [];
    const slotSection = article.querySelector('.slot-section');
    slotSection.classList.toggle('hidden', e.target.checked);
    slotSection.classList.toggle('visible', !e.target.checked);
    refreshAdjSection(ds, article);
    updateProgressDots();
    updateSubmitWarning();
  });

  article.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => togglePreset(ds, btn.dataset.slotId, article));
  });

  refreshAdjSection(ds, article);
  return article;
}

function togglePreset(ds, presetId, article) {
  const preset = PRESET_SLOTS.find(p => p.id === presetId);
  const idx = state[ds].slots.findIndex(s => s.id === presetId);
  if (idx >= 0) {
    state[ds].slots.splice(idx, 1);
  } else {
    state[ds].slots.push({ id: presetId, start: preset.start, end: preset.end });
  }
  const btn = article.querySelector(`.preset-btn[data-slot-id="${presetId}"]`);
  btn.classList.toggle('selected', idx < 0);
  refreshAdjSection(ds, article);
  updateProgressDots();
  updateSubmitWarning();
}

function refreshAdjSection(ds, article) {
  const adjEl = article.querySelector(`#adj-${ds}`);
  const slots = state[ds].slots;

  if (slots.length === 0) {
    adjEl.classList.remove('visible');
    adjEl.classList.add('hidden');
    adjEl.innerHTML = '';
  } else {
    adjEl.classList.remove('hidden');
    adjEl.classList.add('visible');
    adjEl.innerHTML = slots.map(slot => buildAdjRow(slot)).join('');

    adjEl.querySelectorAll('.time-adj-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const slotId  = btn.closest('.time-adj-row').dataset.slotId;
        const field   = btn.dataset.field;
        const delta   = parseInt(btn.dataset.delta, 10);
        const slotIdx = state[ds].slots.findIndex(s => s.id === slotId);
        if (slotIdx < 0) return;
        const sl  = state[ds].slots[slotIdx];
        const min = field === 'start' ? TIME_MIN : timeToMinutes(sl.start) + TIME_STEP;
        const max = field === 'end'   ? TIME_MAX : timeToMinutes(sl.end)   - TIME_STEP;
        sl[field] = addMinutes(sl[field], delta, min, max);
        refreshAdjSection(ds, article);
        updateSummary(ds, article);
      });
    });

    adjEl.querySelectorAll('.time-display').forEach(display => {
      display.addEventListener('click', () => {
        const hidden = display.querySelector('input[type="time"]');
        hidden.click();
        hidden.addEventListener('change', () => {
          const slotId  = display.closest('.time-adj-row').dataset.slotId;
          const field   = display.dataset.field;
          const slotIdx = state[ds].slots.findIndex(s => s.id === slotId);
          if (slotIdx < 0) return;
          const [h, m] = hidden.value.split(':').map(Number);
          state[ds].slots[slotIdx][field] = minutesToTime(h * 60 + m);
          refreshAdjSection(ds, article);
          updateSummary(ds, article);
        }, { once: true });
      });
    });
  }

  updateSummary(ds, article);
}

function buildAdjRow(slot) {
  const preset   = PRESET_SLOTS.find(p => p.id === slot.id);
  const label    = preset ? preset.label : '自訂';
  const startMin = timeToMinutes(slot.start);
  const endMin   = timeToMinutes(slot.end);
  const invalid  = startMin >= endMin;

  return `
    <div class="time-adj-row" data-slot-id="${slot.id}">
      <span class="time-adj-row__label">${label}</span>
      <div class="time-adj">
        <button class="time-adj-btn" data-field="start" data-delta="-${TIME_STEP}"
          ${startMin <= TIME_MIN ? 'disabled' : ''}>←</button>
        <span class="time-display ${invalid ? 'error' : ''}" data-field="start">
          ${slot.start}
          <input type="time" style="position:absolute;opacity:0;pointer-events:none;width:0;height:0">
        </span>
        <button class="time-adj-btn" data-field="start" data-delta="${TIME_STEP}"
          ${startMin >= endMin - TIME_STEP ? 'disabled' : ''}>→</button>
      </div>
      <span class="time-adj-row__sep">–</span>
      <div class="time-adj">
        <button class="time-adj-btn" data-field="end" data-delta="-${TIME_STEP}"
          ${endMin <= startMin + TIME_STEP ? 'disabled' : ''}>←</button>
        <span class="time-display ${invalid ? 'error' : ''}" data-field="end">
          ${slot.end}
          <input type="time" style="position:absolute;opacity:0;pointer-events:none;width:0;height:0">
        </span>
        <button class="time-adj-btn" data-field="end" data-delta="${TIME_STEP}"
          ${endMin >= TIME_MAX ? 'disabled' : ''}>→</button>
      </div>
    </div>
  `;
}

function applyToAll(sourceDs) {
  const src = state[sourceDs];
  weekDates.forEach(d => {
    const ds = formatDateISO(d);
    if (ds === sourceDs) return;
    state[ds] = {
      unavailable: src.unavailable,
      slots: src.slots.map(sl => ({ ...sl })),
    };
  });
  renderAll();
  const btn = document.getElementById(`day-${sourceDs}`)?.querySelector('.day-card__apply-btn');
  if (btn) {
    btn.textContent = '已套用！';
    btn.classList.add('applied');
    setTimeout(() => {
      btn.textContent = '套用到其他天';
      btn.classList.remove('applied');
    }, 2000);
  }
}

function updateSummary(ds, article) {
  const el = article.querySelector(`#summary-${ds}`);
  if (!el) return;
  el.textContent = formatSlotSummary(state[ds].slots);
}

function updateProgressDots() {
  const dotsEl = document.getElementById('progressDots');
  if (!dotsEl) return;
  dotsEl.innerHTML = '';
  weekDates.forEach(d => {
    const ds = formatDateISO(d);
    const s = state[ds];
    const filled = s.unavailable || s.slots.length > 0;
    const btn = document.createElement('button');
    btn.className = 'progress-dot' + (filled ? ' filled' : '');
    btn.title = formatDateLabel(d);
    btn.addEventListener('click', () => {
      document.getElementById(`day-${ds}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    dotsEl.appendChild(btn);
  });
}

function updateSubmitWarning() {
  const unfilled = weekDates.filter(d => {
    const ds = formatDateISO(d);
    const s = state[ds];
    return !s.unavailable && s.slots.length === 0;
  }).length;
  const warn = document.getElementById('submitWarning');
  if (warn) warn.textContent = unfilled > 0 ? `⚠️ 尚有 ${unfilled} 天未填寫` : '';
}

// --- 複製他人 ---
document.getElementById('copyFromBtn').addEventListener('click', openCopySheet);
document.getElementById('sheetCancel').addEventListener('click', closeCopySheet);
document.getElementById('copySheet').addEventListener('click', e => {
  if (e.target.id === 'copySheet') closeCopySheet();
});
document.getElementById('copyBannerClose').addEventListener('click', () => {
  document.getElementById('copyBanner').classList.add('hidden');
});

async function openCopySheet() {
  const sheet       = document.getElementById('copySheet');
  const sheetMembersEl = document.getElementById('sheetMembers');
  sheet.classList.remove('hidden');
  sheetMembersEl.innerHTML = '<p class="sheet-loading">載入中…</p>';

  let filledSet = new Set();
  try { filledSet = await getWeekFilledMembers(weekId); } catch (e) {}

  sheetMembersEl.innerHTML = '';
  MEMBERS.filter(m => m.id !== memberId).forEach(m => {
    const isFilled = filledSet.has(m.id);
    const name = allProfiles[m.id]?.displayName ?? m.name;
    const btn = document.createElement('button');
    btn.className = 'sheet-member-btn' + (isFilled ? '' : ' unfilled');
    btn.innerHTML = `<span>${name}</span>${isFilled ? '' : '<span class="sheet-member-btn__status">未填</span>'}`;
    btn.addEventListener('click', () => handleCopySelect(m.id, name));
    sheetMembersEl.appendChild(btn);
  });
}

function closeCopySheet() {
  document.getElementById('copySheet').classList.add('hidden');
}

async function handleCopySelect(sourceMemberId, sourceName) {
  closeCopySheet();
  const container = document.getElementById('dayCardsContainer');
  container.innerHTML = `<p style="padding:var(--space-8);text-align:center;color:var(--text-muted)">套用中…</p>`;

  try {
    const saved = await getMemberWeekData(weekId, sourceMemberId);
    if (Object.keys(saved).length === 0) {
      renderAll();
      showBannerMsg(`${sourceName} 本週尚無填寫資料`);
      return;
    }
    applyMemberData(saved);
    copySource = sourceMemberId;
    renderAll();
    showBannerMsg(`已套用 ${sourceName} 的資料，請確認後再送出`, false);
  } catch (e) {
    console.error(e);
    renderAll();
    showBannerMsg('載入失敗，請重試');
  }
}

function showBannerMsg(msg, autoDismiss = true) {
  const banner = document.getElementById('copyBanner');
  document.getElementById('copyBannerText').textContent = msg;
  banner.classList.remove('hidden');
  if (autoDismiss) setTimeout(() => banner.classList.add('hidden'), 3000);
}

// --- 送出 ---
function computeAvailabilityDiff(original, next) {
  const diff = {};
  for (const date of Object.keys(next)) {
    const from = original[date] || { unavailable: false, slots: [] };
    const to   = next[date];
    const fromSlots = JSON.stringify((from.slots || []).map(s => ({ start: s.start, end: s.end })));
    const toSlots   = JSON.stringify(to.slots.map(s => ({ start: s.start, end: s.end })));
    if (from.unavailable !== to.unavailable || fromSlots !== toSlots) {
      diff[date] = {
        from: { unavailable: from.unavailable, slots: (from.slots || []).map(s => ({ start: s.start, end: s.end })) },
        to:   { unavailable: to.unavailable,   slots: to.slots.map(s => ({ start: s.start, end: s.end })) },
      };
    }
  }
  return diff;
}

document.getElementById('submitBtn').addEventListener('click', async () => {
  const unfilled = weekDates.filter(d => {
    const ds = formatDateISO(d);
    const s = state[ds];
    return !s.unavailable && s.slots.length === 0;
  }).length;

  if (unfilled > 0) {
    if (!confirm(`確定送出未完整的填寫？\n${unfilled} 天尚未填寫，將視為「待定」。`)) return;
  }

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner spinner--sm"></span>儲存中…';

  const payload = {};
  weekDates.forEach(d => {
    const ds = formatDateISO(d);
    const s = state[ds];
    payload[ds] = {
      unavailable: s.unavailable,
      slots: s.slots.map(sl => ({ start: sl.start, end: sl.end })),
    };
  });

  try {
    await saveMemberWeekData(weekId, memberId, payload);
    const diff = computeAvailabilityDiff(originalData, payload);
    addLog(weekId, {
      action: 'availability_submit',
      memberId,
      diff,
      copySource: copySource || null,
    }).catch(e => console.warn('Log write failed:', e));
    btn.textContent = '✅ 已送出！';
    setTimeout(() => { location.href = `index.html?week=${weekId}`; }, 1200);
  } catch (e) {
    console.error(e);
    btn.disabled = false;
    btn.innerHTML = '✅ 確認送出';
    alert('儲存失敗，請確認網路後重試。');
  }
});

init();
