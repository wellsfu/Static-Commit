import { MEMBERS, PRESET_SLOTS, TIME_MIN, TIME_MAX, TIME_STEP } from './constants.js';
import {
  getWeekId, getWeekDates, formatDateLabel, formatDateISO,
  timeToMinutes, minutesToTime, addMinutes, formatSlotSummary
} from './utils.js';
import { getMemberWeekData, saveMemberWeekData, getMemberProfiles } from './data.js';

const params   = new URLSearchParams(location.search);
const memberId = params.get('member');
const weekId   = params.get('week') || getWeekId();

if (!memberId || !MEMBERS.find(m => m.id === memberId)) {
  location.href = 'index.html';
}

document.querySelector('.fill-nav__back').href = `index.html?week=${weekId}`;

getMemberProfiles().then(profiles => {
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

async function init() {
  const overlay = document.getElementById('loadingOverlay');
  try {
    const saved = await getMemberWeekData(weekId, memberId);
    weekDates.forEach(d => {
      const ds = formatDateISO(d);
      if (saved[ds]) {
        // Convert stored slots (no id) back — match by start time to preset
        const rawSlots = saved[ds].slots || [];
        state[ds] = {
          unavailable: saved[ds].unavailable || false,
          slots: rawSlots.map(s => {
            const preset = PRESET_SLOTS.find(p => p.start === s.start && p.end === s.end);
            return { id: preset ? preset.id : 'custom_' + s.start, start: s.start, end: s.end };
          }),
        };
      }
    });
  } catch (e) {
    // no prior data
  }
  renderAll();
  overlay.classList.add('fade-out');
  setTimeout(() => overlay.remove(), 300);
}

function renderAll() {
  const container = document.getElementById('dayCardsContainer');
  container.innerHTML = '';
  weekDates.forEach(d => {
    const ds = formatDateISO(d);
    container.appendChild(buildDayCard(d, ds));
  });
  updateProgressDots();
  updateSubmitWarning();
}

function buildDayCard(date, ds) {
  const s = state[ds];
  const article = document.createElement('article');
  article.className = 'day-card';
  article.id = `day-${ds}`;
  article.dataset.date = ds;

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
        ${PRESET_SLOTS.map(p => `
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
        const slotId = btn.closest('.time-adj-row').dataset.slotId;
        const field  = btn.dataset.field;
        const delta  = parseInt(btn.dataset.delta, 10);
        const slotIdx = state[ds].slots.findIndex(s => s.id === slotId);
        if (slotIdx < 0) return;
        const sl = state[ds].slots[slotIdx];
        const min = field === 'start' ? TIME_MIN : timeToMinutes(sl.start) + TIME_STEP;
        const max = field === 'end'   ? TIME_MAX : timeToMinutes(sl.end) - TIME_STEP;
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
          const slotId = display.closest('.time-adj-row').dataset.slotId;
          const field  = display.dataset.field;
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
  const preset = PRESET_SLOTS.find(p => p.id === slot.id);
  const label = preset ? preset.label : '自訂';
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
    btn.textContent = '✅ 已送出！';
    setTimeout(() => { location.href = 'index.html'; }, 1200);
  } catch (e) {
    console.error(e);
    btn.disabled = false;
    btn.innerHTML = '✅ 確認送出';
    alert('儲存失敗，請確認網路後重試。');
  }
});

init();
