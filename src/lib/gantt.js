/* ---------------------------------------------------------
   ตัวช่วยคำนวณคอลัมน์ตาราง Gantt แบบยืดหยุ่น
   รองรับทั้งหน่วยวัน (step เป็นวัน) และหน่วยชั่วโมง (step เป็นชั่วโมง)
--------------------------------------------------------- */

const MS_DAY = 24 * 60 * 60 * 1000;
const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** สร้างคอลัมน์แบบรายวัน จาก startISO ถึง endISO ทุกๆ stepDays วัน */
export function buildDayColumns(startISO, endISO, stepDays) {
  const start = new Date(startISO + "T00:00:00");
  const end = new Date(endISO + "T00:00:00");
  const step = Math.max(1, Number(stepDays) || 1);
  const cols = [];
  let cursor = new Date(start);
  let lastMonth = null;
  while (cursor <= end) {
    const month = cursor.getMonth();
    cols.push({
      key: cursor.toISOString().slice(0, 10),
      day: cursor.getDate(),
      showMonth: month !== lastMonth,
      monthLabel: THAI_MONTHS_SHORT[month],
      date: new Date(cursor),
    });
    lastMonth = month;
    cursor = new Date(cursor.getTime() + step * MS_DAY);
  }
  if (cols.length === 0) {
    cols.push({ key: startISO, day: start.getDate(), showMonth: true, monthLabel: THAI_MONTHS_SHORT[start.getMonth()], date: start });
  }
  return { columns: cols, stepMs: step * MS_DAY, rangeStart: start };
}

/** สร้างคอลัมน์แบบรายชั่วโมง ในวันเดียว จาก startHour ถึง endHour ทุกๆ stepHours ชม. */
export function buildHourColumns(dateISO, startHour, endHour, stepHours) {
  const base = new Date(dateISO + "T00:00:00");
  const step = Math.max(1, Number(stepHours) || 1);
  const sh = Math.max(0, Math.min(23, Number(startHour) || 0));
  const eh = Math.max(sh, Math.min(24, Number(endHour) || 24));
  const cols = [];
  for (let h = sh; h <= eh; h += step) {
    cols.push({ key: `h${h}`, label: `${String(h).padStart(2, "0")}:00`, hour: h });
  }
  const rangeStart = new Date(base.getTime() + sh * 60 * 60 * 1000);
  return { columns: cols, stepMs: step * 60 * 60 * 1000, rangeStart };
}

/** คำนวณว่างานหนึ่งชิ้น ครอบคลุมคอลัมน์ index ไหนบ้าง (คืน {startIdx, endIdx}) */
export function taskColumnRange(rangeStart, stepMs, columnsCount, taskStart, taskEnd) {
  const s = new Date(taskStart).getTime();
  const e = new Date(taskEnd).getTime();
  let startIdx = Math.floor((s - rangeStart.getTime()) / stepMs);
  let endIdx = Math.floor((e - rangeStart.getTime()) / stepMs);
  startIdx = Math.max(0, Math.min(columnsCount - 1, startIdx));
  endIdx = Math.max(startIdx, Math.min(columnsCount - 1, endIdx));
  return { startIdx, endIdx };
}

export const PLAN_DAY_STEPS = [
  { value: 1, label: "ทุกวัน" },
  { value: 2, label: "ทุก 2 วัน" },
  { value: 3, label: "ทุก 3 วัน" },
  { value: 7, label: "ทุกสัปดาห์" },
  { value: 14, label: "ทุก 2 สัปดาห์" },
];

export const PLAN_HOUR_STEPS = [
  { value: 1, label: "ทุกชั่วโมง" },
  { value: 2, label: "ทุก 2 ชั่วโมง" },
  { value: 3, label: "ทุก 3 ชั่วโมง" },
];
