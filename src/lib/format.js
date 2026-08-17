import { THAI_MONTHS, THAI_MONTHS_FULL } from "./constants.js";

/* ---------------------------------------------------------
   ฟังก์ชันจัดรูปแบบข้อมูล (วันที่ / ตัวเลข / ตัวหนังสือไทย)
--------------------------------------------------------- */

export function uid(prefix) {
  return prefix + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** แปลง ISO date เป็น dd/mm/yyyy พ.ศ. — ใช้บนเอกสาร */
export function formatShortThaiDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear() + 543}`;
}

/** แปลงเป็น "4 มิ.ย. 2569" */
export function formatThaiDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

/** แปลงเป็น "มิถุนายน 2569" — ใช้บนหัวรายงานรายเดือน */
export function formatThaiMonthYear(ym) {
  if (!ym) return "—";
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return "—";
  return `${THAI_MONTHS_FULL[m - 1]} ${y + 543}`;
}

/** คืนค่า YYYY-MM ของ ISO date */
export function monthKey(dateStr) {
  return dateStr ? dateStr.slice(0, 7) : "";
}

/** ตัวเลขเป็นรูปแบบเงิน 2 ตำแหน่ง มี comma */
export function baht(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** ตัวเลขไม่มีทศนิยม (ใช้กับปริมาณ) */
export function num(n, digits = 2) {
  const v = Number(n) || 0;
  return v.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

/* ---------------------------------------------------------
   แปลงจำนวนเงินเป็นตัวหนังสือไทย
   เช่น 64200 → "หกหมื่นสี่พันสองร้อยบาทถ้วน"
--------------------------------------------------------- */
const TH_DIGITS = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const TH_PLACES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

function readIntegerGroup(numStr) {
  // อ่านเลขไม่เกิน 7 หลัก (ถึงหลักล้าน)
  let out = "";
  const len = numStr.length;
  for (let i = 0; i < len; i++) {
    const digit = Number(numStr[i]);
    const place = len - i - 1;
    if (digit === 0) continue;
    if (place === 1) {
      // หลักสิบ
      out += digit === 1 ? "สิบ" : digit === 2 ? "ยี่สิบ" : TH_DIGITS[digit] + "สิบ";
    } else if (place === 0) {
      // หลักหน่วย
      out += digit === 1 && len > 1 ? "เอ็ด" : TH_DIGITS[digit];
    } else {
      out += TH_DIGITS[digit] + TH_PLACES[place];
    }
  }
  return out;
}

function readInteger(n) {
  if (n === 0) return "ศูนย์";
  let s = String(n);
  let out = "";
  // แยกกลุ่มล้าน
  while (s.length > 6) {
    const head = s.slice(0, s.length - 6);
    const tail = s.slice(s.length - 6);
    out = readIntegerGroup(tail) + "ล้าน" + out;
    s = head;
  }
  return readIntegerGroup(s) + out;
}

/** จำนวนเงิน → ตัวหนังสือไทย */
export function bahtText(amount) {
  const v = Math.abs(Number(amount) || 0);
  const rounded = Math.round(v * 100) / 100;
  const intPart = Math.floor(rounded);
  const satang = Math.round((rounded - intPart) * 100);
  const sign = Number(amount) < 0 ? "ลบ" : "";

  if (intPart === 0 && satang === 0) return "ศูนย์บาทถ้วน";

  let text = sign;
  if (intPart > 0) text += readInteger(intPart) + "บาท";
  if (satang > 0) {
    if (intPart === 0) text += "";
    text += readInteger(satang) + "สตางค์";
  } else {
    text += "ถ้วน";
  }
  return text;
}

/* ---------------------------------------------------------
   คำนวณยอดเอกสาร
--------------------------------------------------------- */
export function computeFinTotal(items, vat, discount = 0) {
  const subtotal = (items || []).reduce((sum, it) => {
    const line = (Number(it.qty) || 0) * (Number(it.price) || 0) - (Number(it.discount) || 0);
    return sum + line;
  }, 0);
  const afterDiscount = subtotal - (Number(discount) || 0);
  const vatAmount = vat ? afterDiscount * 0.07 : 0;
  return {
    subtotal,
    discount: Number(discount) || 0,
    afterDiscount,
    vatAmount,
    total: afterDiscount + vatAmount,
  };
}

export function lineTotal(item) {
  return (Number(item.qty) || 0) * (Number(item.price) || 0) - (Number(item.discount) || 0);
}

/* ---------------------------------------------------------
   คำนวณยอดรายจ่าย/ภาษีซื้อ/หัก ณ ที่จ่าย
--------------------------------------------------------- */
export function computeExpenseTotal(amount, vat, whtApplicable, whtRate) {
  const base = Number(amount) || 0;
  const vatAmount = vat ? base * 0.07 : 0;
  const whtAmount = whtApplicable ? base * (Number(whtRate) || 0) / 100 : 0;
  const totalWithVat = base + vatAmount;
  const netPaid = totalWithVat - whtAmount;
  return { base, vatAmount, whtAmount, totalWithVat, netPaid };
}
export function computeBoqTotals(items, markupPercent, vat, discount) {
  const materialTotal = (items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.materialUnitPrice) || 0), 0);
  const laborTotal = (items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.laborUnitPrice) || 0), 0);
  const constructionTotal = materialTotal + laborTotal;
  const markupAmount = constructionTotal * (Number(markupPercent) || 0) / 100;
  const afterMarkup = constructionTotal + markupAmount;
  const vatAmount = vat ? afterMarkup * 0.07 : 0;
  const total = afterMarkup + vatAmount - (Number(discount) || 0);
  return { materialTotal, laborTotal, constructionTotal, markupAmount, afterMarkup, vatAmount, total };
}
