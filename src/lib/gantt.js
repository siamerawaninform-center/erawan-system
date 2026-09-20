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

/* ---------- ตัวช่วยวันที่ (ใช้ UTC กันวันเพี้ยนจาก timezone) ---------- */
export function addDaysISO(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function diffDaysISO(aISO, bISO) {
  return Math.round((Date.parse(bISO + "T00:00:00Z") - Date.parse(aISO + "T00:00:00Z")) / MS_DAY);
}

/** จำนวนวันที่แผนรายชั่วโมงข้ามไป (0 = ภายในวันเดียว, 1 = ไปสิ้นสุดวันถัดไป) */
export function hourPlanDayOffset(plan) {
  if (!plan.hourEndDate || !plan.hourDate) return 0;
  return Math.max(0, diffDaysISO(plan.hourDate, plan.hourEndDate));
}

/** ชั่วโมงสิ้นสุดแบบสะสม นับจาก 00:00 ของ hourDate (เช่น 04:00 วันถัดไป = 28) */
export function hourPlanEndAbs(plan) {
  return Number(plan.endHour) + 24 * hourPlanDayOffset(plan);
}

/** ป้ายเวลาแบบสะสม: 25 -> "01:00 (วันถัดไป)" */
export function formatAbsHour(h) {
  h = Number(h);
  const day = Math.floor(h / 24);
  const hh = String(h % 24).padStart(2, "0") + ":00";
  if (day <= 0) return hh;
  return day === 1 ? `${hh} (วันถัดไป)` : `${hh} (+${day} วัน)`;
}

/**
 * แผนรายชั่วโมงที่บันทึกไว้ก่อนรองรับข้ามวัน (ไม่มี hourEndDate)
 * ถ้าเวลาสิ้นสุด <= เวลาเริ่ม แปลว่าข้ามคืน -> แปลงเป็นแบบข้ามวันให้อัตโนมัติ
 * (เวลางานที่ตัวเลขน้อยกว่าเวลาเริ่ม = ผ่านเที่ยงคืนไปแล้ว บวก 24)
 */
export function normalizeHourPlan(plan) {
  if (!plan || plan.unit !== "hour" || plan.hourEndDate) return plan;
  const sh = Number(plan.startHour), eh = Number(plan.endHour);
  if (eh > sh) return { ...plan, hourEndDate: plan.hourDate };
  const fix = (h) => (Number(h) < sh ? Number(h) + 24 : Number(h));
  const tasks = (plan.tasks || []).map((t) => {
    const s = fix(t.start);
    let e = fix(t.end);
    if (e < s) e += 24;
    return { ...t, start: s, end: e };
  });
  return { ...plan, hourEndDate: addDaysISO(plan.hourDate, 1), tasks };
}

/** สร้างคอลัมน์แบบรายชั่วโมง จาก (dateISO startHour) ถึง (endDateISO endHour) ทุกๆ stepHours ชม. — ข้ามคืนได้ */
export function buildHourColumns(dateISO, startHour, endHour, stepHours, endDateISO) {
  const base = new Date(dateISO + "T00:00:00");
  const step = Math.max(1, Number(stepHours) || 1);
  const offset = endDateISO ? Math.max(0, diffDaysISO(dateISO, endDateISO)) : 0;
  const sh = Math.max(0, Math.min(23, Number(startHour) || 0));
  const eh = Math.max(sh, Math.min(24 * (offset + 1), Number(endHour) + 24 * offset));
  const cols = [];
  for (let h = sh; h <= eh; h += step) {
    const dayIdx = Math.floor(h / 24);
    const date = new Date(base);
    date.setDate(date.getDate() + dayIdx);
    cols.push({
      key: `h${h}`,
      label: `${String(h % 24).padStart(2, "0")}:00`,
      hour: h % 24,
      absHour: h,
      dayIdx,
      date,
      monthLabel: THAI_MONTHS_SHORT[date.getMonth()],
    });
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
