import { FIN_TYPE_PREFIX, SALES_SET_TYPES } from "./constants.js";

/* ---------------------------------------------------------
   ระบบเลขที่เอกสาร — ทำตามรูปแบบจริงที่บริษัทใช้อยู่

   เอกสารชุดขาย (ใบวางบิล / ใบแจ้งหนี้ / ใบกำกับภาษี / ใบเสร็จ):
     {PREFIX}-{YYMM พ.ศ.}-{เลขวิ่ง 8 หลัก}
     เช่น BP-6906-00000157, PT-6906-00000157
     → เอกสารชุดเดียวกันใช้เลขวิ่งเดียวกัน ต่างแค่ prefix

   ใบเสนอราคา:
     QT-{YYYY ค.ศ.}{MM}{เลขวิ่ง 3 หลัก}
     เช่น QT-202602014
--------------------------------------------------------- */

/** คืนค่า YYMM แบบ พ.ศ. จาก ISO date เช่น 2026-06-04 → "6906" */
export function bePeriod(dateStr) {
  const d = dateStr ? new Date(dateStr + "T00:00:00") : new Date();
  const beYear = d.getFullYear() + 543;
  const yy = String(beYear).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yy}${mm}`;
}

/** คืนค่า YYYYMM แบบ ค.ศ. เช่น 2026-02-10 → "202602" */
export function cePeriod(dateStr) {
  const d = dateStr ? new Date(dateStr + "T00:00:00") : new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}${mm}`;
}

/**
 * หาเลขวิ่งถัดไปของเอกสารชุดขายในเดือนนั้น
 * นับจากเอกสารทุกใบที่มี period เดียวกัน (ไม่แยกตามประเภท เพราะใช้เลขร่วมกัน)
 */
export function nextSalesRunning(existingFin, dateStr, startFrom = 1) {
  const period = bePeriod(dateStr);
  let max = 0;
  (existingFin || []).forEach((f) => {
    if (!f.running || f.period !== period) return;
    const n = Number(f.running);
    if (!isNaN(n) && n > max) max = n;
  });
  // ใช้เลขที่มากกว่าเสมอ ระหว่าง (เอกสารล่าสุด+1) กับ (เลขวิ่งเริ่มต้นที่ตั้งไว้)
  // กันกรณีมีเอกสารทดสอบค้างอยู่ ทำให้เลขที่ตั้งไว้ไม่มีผล
  return Math.max(max + 1, Number(startFrom) || 1);
}

/** หาเลขวิ่งถัดไปของใบเสนอราคาในเดือนนั้น */
export function nextQuoteRunning(existingFin, dateStr, startFrom = 1) {
  const period = cePeriod(dateStr);
  let max = 0;
  (existingFin || []).forEach((f) => {
    if (f.type !== "ใบเสนอราคา" || f.period !== period || !f.running) return;
    const n = Number(f.running);
    if (!isNaN(n) && n > max) max = n;
  });
  return Math.max(max + 1, Number(startFrom) || 1);
}

/** ประกอบเลขที่เอกสารจาก type + period + running */
export function buildDocCode(type, period, running) {
  const prefix = FIN_TYPE_PREFIX[type] || "DOC";
  if (type === "ใบเสนอราคา") {
    return `${prefix}-${period}${String(running).padStart(3, "0")}`;
  }
  return `${prefix}-${period}-${String(running).padStart(8, "0")}`;
}

/**
 * สร้าง period + running + code สำหรับเอกสารใหม่
 * คืนค่า { period, running, code }
 */
export function allocateDocNumber(existingFin, type, dateStr, company) {
  if (type === "ใบเสนอราคา") {
    const period = cePeriod(dateStr);
    const running = nextQuoteRunning(existingFin, dateStr, company?.startingRunning?.quote);
    return { period, running, code: buildDocCode(type, period, running) };
  }
  const period = bePeriod(dateStr);
  const running = nextSalesRunning(existingFin, dateStr, company?.startingRunning?.salesSet);
  return { period, running, code: buildDocCode(type, period, running) };
}

/**
 * เอกสารชุดขาย: คืนเลขที่เอกสารทุกประเภทจาก period+running เดียวกัน
 * ใช้ตอนพิมพ์ เพื่อให้ใบวางบิลอ้างอิงเลขใบกำกับภาษีได้ถูกต้อง
 */
export function siblingCodes(period, running) {
  const out = {};
  SALES_SET_TYPES.forEach((t) => {
    out[t] = buildDocCode(t, period, running);
  });
  return out;
}

/** รหัสโปรเจกต์ SEC-{พ.ศ.}-{เลขวิ่ง 3 หลัก} */
export function nextProjectCode(existingProjects) {
  const beYear = new Date().getFullYear() + 543;
  const prefix = `SEC-${beYear}-`;
  let max = 0;
  (existingProjects || []).forEach((p) => {
    if (!p.code || !p.code.startsWith(prefix)) return;
    const n = Number(p.code.slice(prefix.length));
    if (!isNaN(n) && n > max) max = n;
  });
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/** รหัสลูกค้า A-001, A-002, ... */
export function nextCustomerCode(existingCustomers) {
  let max = 0;
  (existingCustomers || []).forEach((c) => {
    if (!c.code) return;
    const m = c.code.match(/^A-(\d+)$/);
    if (m) {
      const n = Number(m[1]);
      if (n > max) max = n;
    }
  });
  return `A-${String(max + 1).padStart(3, "0")}`;
}

/** รหัสซัพพลายเออร์ S-001, S-002, ... */
export function nextSupplierCode(existingSuppliers) {
  let max = 0;
  (existingSuppliers || []).forEach((s) => {
    if (!s.code) return;
    const m = s.code.match(/^S-(\d+)$/);
    if (m) {
      const n = Number(m[1]);
      if (n > max) max = n;
    }
  });
  return `S-${String(max + 1).padStart(3, "0")}`;
}

/** รหัสรายจ่าย EXP-{ปีเดือน ค.ศ.}-{เลขวิ่ง} */
export function nextExpenseCode(existingExpenses, dateStr) {
  const period = cePeriod(dateStr);
  const n = (existingExpenses || []).filter((e) => e.code && e.code.includes(period)).length + 1;
  return `EXP-${period}-${String(n).padStart(3, "0")}`;
}

/** เลขที่หนังสือรับรองหัก ณ ที่จ่าย WHT-{ปีเดือน ค.ศ.}-{เลขวิ่ง} */
export function nextWhtCertNo(existingExpenses, dateStr) {
  const period = cePeriod(dateStr);
  const n = (existingExpenses || []).filter((e) => e.whtCertNo && e.whtCertNo.includes(period)).length + 1;
  return `WHT-${period}-${String(n).padStart(3, "0")}`;
}

/** รหัสหนี้สิน DEBT-001 */
export function nextDebtCode(existingDebts) {
  const n = (existingDebts || []).length + 1;
  return `DEBT-${String(n).padStart(3, "0")}`;
}

/** รหัสเอกสารแนบ DOC-0001 */
export function nextAttachCode(existingDocs) {
  return `DOC-${String((existingDocs?.length || 0) + 1).padStart(4, "0")}`;
}

/** รหัส BOQ ต่อโปรเจกต์ BOQ-{รหัสโปรเจกต์}-{เลขวิ่ง} */
export function nextBoqCode(existingBoqs, projectCode) {
  const n = (existingBoqs || []).filter((b) => b.projectCode === projectCode).length + 1;
  return `BOQ-${projectCode}-${String(n).padStart(2, "0")}`;
}

/** รหัสแผนงาน PLAN-{รหัสโปรเจกต์}-{เลขวิ่ง} */
export function nextPlanCode(existingPlans, projectCode) {
  const n = (existingPlans || []).filter((p) => p.projectCode === projectCode).length + 1;
  return `PLAN-${projectCode}-${String(n).padStart(2, "0")}`;
}

/** รหัส JSA JSA-{รหัสโปรเจกต์}-{เลขวิ่ง} */
export function nextJsaCode(existingJsas, projectCode) {
  const n = (existingJsas || []).filter((j) => j.projectCode === projectCode).length + 1;
  return `JSA-${projectCode}-${String(n).padStart(2, "0")}`;
}
