export function getMonday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getISOWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export function getWeekId(date = new Date()) {
  const monday = getMonday(date);
  const year = monday.getFullYear();
  const weekNum = getISOWeekNumber(monday);
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

export function getWeekDates(weekId) {
  const [yearStr, wStr] = weekId.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(wStr, 10);

  // Find Jan 4 of that year (always in week 1)
  const jan4 = new Date(year, 0, 4);
  const jan4Monday = getMonday(jan4);
  const monday = new Date(jan4Monday);
  monday.setDate(jan4Monday.getDate() + (week - 1) * 7);
  monday.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export function formatDateLabel(date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
  return `${month}/${day}（週${dayNames[date.getDay()]}）`;
}

export function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getWeekLabel(weekDates) {
  const start = weekDates[0];
  const end = weekDates[6];
  const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
  return `${start.getMonth() + 1}/${start.getDate()}（${dayNames[start.getDay()]}）– ${end.getMonth() + 1}/${end.getDate()}（${dayNames[end.getDay()]}）`;
}

export function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function addMinutes(timeStr, delta, min, max) {
  let total = timeToMinutes(timeStr) + delta;
  total = Math.max(min, Math.min(max, total));
  return minutesToTime(total);
}

export function formatSlotSummary(slots) {
  if (!slots || slots.length === 0) return '';
  return slots.map(s => `${s.start} – ${s.end}`).join('、');
}
