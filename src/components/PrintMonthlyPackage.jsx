import logoUrl from "../assets/logo.png";
import {
  baht, bahtText, formatShortThaiDate, computeFinTotal, computeExpenseTotal, formatThaiMonthYear,
} from "../lib/format.js";
import { buildDocCode } from "../lib/docNumber.js";
import { COMPANY_DEFAULT } from "../lib/constants.js";

/* ---------------------------------------------------------
   พิมพ์ "แพ็คเกจส่งบัญชี" ประจำเดือน — เปิดหน้าต่างแยกต่างหาก
   รวม: หน้าปกสรุปยอด + รายงานภาษีขาย + รายงานภาษีซื้อ + รายงานหัก ณ ที่จ่าย
   ข้ามหน้าที่ไม่มีรายการ เพื่อประหยัดกระดาษ
--------------------------------------------------------- */

const PRINT_CSS = `
  @page { size: A4; margin: 0; }
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+Thai:wght@600;700&family=Sarabun:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
  *{ box-sizing:border-box; }
  body{ margin:0; font-family:'TH Sarabun New','TH Sarabun PSK','Sarabun',sans-serif; color:#171717; font-size:13.5px; }
  .sheet{ width:210mm; min-height:297mm; padding:16mm 16mm 14mm; page-break-after:always; }
  .sheet:last-child{ page-break-after:auto; }
  .hdr{ display:flex; align-items:center; gap:12px; border-bottom:3px solid #880808; padding-bottom:10px; margin-bottom:16px; }
  .hdr img{ width:46px; height:46px; object-fit:contain; }
  .hdr-name{ font-family:'Noto Serif Thai',serif; font-weight:700; font-size:14px; }
  .hdr-meta{ font-size:12px; color:#444; line-height:1.5; }
  .title{ font-family:'Noto Serif Thai',serif; font-weight:700; font-size:19px; color:#880808; margin-bottom:4px; }
  .subtitle{ font-family:'IBM Plex Mono',monospace; font-size:13px; color:#666; margin-bottom:16px; }
  .cover-grid{ display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:10px; }
  .cover-card{ border:1px solid #ddd; padding:14px 16px; }
  .cover-card.warn{ border-color:#8C3A22; background:#fdf4f1; }
  .cover-label{ font-size:12.5px; color:#666; margin-bottom:6px; }
  .cover-value{ font-family:'IBM Plex Mono',monospace; font-size:22px; font-weight:700; }
  table{ width:100%; border-collapse:collapse; font-size:12px; }
  th{ background:#171717; color:#fff; padding:6px 5px; text-align:center; font-size:11px; font-weight:700; }
  td{ padding:5px; border-bottom:1px solid #e0e0e0; }
  .num{ text-align:right; font-family:'IBM Plex Mono',monospace; }
  .center{ text-align:center; }
  tfoot td{ font-weight:700; border-top:2px solid #171717; background:#f2f2f2; }
  .note{ font-size:10.5px; color:#666; margin-top:12px; }
  .pv-bar{ position:sticky; top:0; z-index:10; background:#1a1a1a; color:#fff; padding:10px 16px; display:flex; justify-content:space-between; align-items:center; }
  .pv-bar button{ background:#880808; color:#fff; border:none; padding:8px 18px; border-radius:4px; font-size:13px; cursor:pointer; font-family:'Sarabun',sans-serif; }
  .pv-bar button:hover{ background:#a91010; }
  .pv-label{ font-size:13px; }
  @media print { .no-print{ display:none !important; } }
`;

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function header(company) {
  return `
    <div class="hdr">
      <img src="${logoUrl}" alt="โลโก้" />
      <div>
        <div class="hdr-name">${esc(company.nameTh)}</div>
        <div class="hdr-meta">${esc(company.address)} · โทร ${esc(company.phone)} · เลขผู้เสียภาษี ${esc(company.taxId)}</div>
      </div>
    </div>`;
}

export function openMonthlyPackagePrint({ ym, salesDocs, expenses, data, customer, supplier }) {
  const company = { ...COMPANY_DEFAULT, ...(data.company || {}) };
  const monthLabel = formatThaiMonthYear(ym);

  const salesTotals = salesDocs.reduce(
    (acc, q) => {
      const t = computeFinTotal(q.items, q.vat, q.discount);
      acc.total += t.total; acc.vat += t.vatAmount;
      return acc;
    },
    { total: 0, vat: 0 }
  );
  const expenseTotals = expenses.reduce(
    (acc, e) => {
      const t = computeExpenseTotal(e.amount, e.vat, e.whtApplicable, e.whtRate);
      acc.total += t.totalWithVat; acc.vat += t.vatAmount; acc.wht += t.whtAmount;
      return acc;
    },
    { total: 0, vat: 0, wht: 0 }
  );
  const netVatDue = salesTotals.vat - expenseTotals.vat;
  const vatExpenses = expenses.filter((e) => e.vat);
  const whtExpenses = expenses.filter((e) => e.whtApplicable);

  /* ---------- หน้าปก ---------- */
  const coverPage = `
  <div class="sheet">
    ${header(company)}
    <div class="title">สรุปยอดประจำเดือน — เอกสารส่งบัญชี</div>
    <div class="subtitle">${esc(monthLabel)}</div>
    <div class="cover-grid">
      <div class="cover-card">
        <div class="cover-label">รายรับรวม (จากเอกสารขาย)</div>
        <div class="cover-value">฿${baht(salesTotals.total)}</div>
      </div>
      <div class="cover-card">
        <div class="cover-label">ภาษีขาย</div>
        <div class="cover-value">฿${baht(salesTotals.vat)}</div>
      </div>
      <div class="cover-card">
        <div class="cover-label">รายจ่ายรวม</div>
        <div class="cover-value">฿${baht(expenseTotals.total)}</div>
      </div>
      <div class="cover-card">
        <div class="cover-label">ภาษีซื้อ</div>
        <div class="cover-value">฿${baht(expenseTotals.vat)}</div>
      </div>
      <div class="cover-card ${netVatDue >= 0 ? "warn" : ""}">
        <div class="cover-label">${netVatDue >= 0 ? "ภาษีมูลค่าเพิ่มที่ต้องนำส่ง" : "ภาษีมูลค่าเพิ่มที่ขอคืนได้"}</div>
        <div class="cover-value">฿${baht(Math.abs(netVatDue))}</div>
      </div>
      <div class="cover-card">
        <div class="cover-label">ยอดหัก ณ ที่จ่ายรวม</div>
        <div class="cover-value">฿${baht(expenseTotals.wht)}</div>
      </div>
    </div>
    <div class="note">
      เอกสารในแพ็คเกจนี้: เอกสารขาย ${salesDocs.length} รายการ · รายจ่าย/ภาษีซื้อ ${expenses.length} รายการ
      (${vatExpenses.length} รายการมี VAT, ${whtExpenses.length} รายการหัก ณ ที่จ่าย)
    </div>
  </div>`;

  /* ---------- รายงานภาษีขาย ---------- */
  const salesRows = salesDocs.map((q, i) => {
    const t = computeFinTotal(q.items, q.vat, q.discount);
    const taxCode = buildDocCode("ใบกำกับภาษี", q.period, q.running);
    const cust = customer(q.customerId);
    return `<tr>
      <td class="center">${i + 1}</td>
      <td class="center">${esc(formatShortThaiDate(q.date))}</td>
      <td class="center mono">${esc(taxCode)}</td>
      <td>${esc(cust?.nameTh || q.customerName || "—")}</td>
      <td class="center">${esc(cust?.taxId || "—")}</td>
      <td class="num">${baht(t.afterDiscount)}</td>
      <td class="num">${baht(t.vatAmount)}</td>
    </tr>`;
  }).join("");

  const salesPage = salesDocs.length === 0 ? "" : `
  <div class="sheet">
    ${header(company)}
    <div class="title">รายงานภาษีขาย</div>
    <div class="subtitle">${esc(monthLabel)}</div>
    <table>
      <thead><tr>
        <th style="width:6%">ลำดับ</th><th style="width:12%">วันที่</th><th style="width:18%">เลขที่ใบกำกับภาษี</th>
        <th style="width:28%">ชื่อผู้ซื้อ</th><th style="width:16%">เลขผู้เสียภาษีผู้ซื้อ</th>
        <th style="width:10%">มูลค่าสินค้า/บริการ</th><th style="width:10%">ภาษีมูลค่าเพิ่ม</th>
      </tr></thead>
      <tbody>${salesRows}</tbody>
      <tfoot><tr><td colspan="5">รวม</td><td class="num">${baht(salesTotals.total - salesTotals.vat)}</td><td class="num">${baht(salesTotals.vat)}</td></tr></tfoot>
    </table>
  </div>`;

  /* ---------- รายงานภาษีซื้อ ---------- */
  const purchaseRows = vatExpenses.map((e, i) => {
    const t = computeExpenseTotal(e.amount, e.vat, e.whtApplicable, e.whtRate);
    const vendorText = e.vendorId ? supplier(e.vendorId)?.nameTh : e.vendorName;
    const vendorTaxId = e.vendorId ? supplier(e.vendorId)?.taxId : e.vendorTaxId;
    return `<tr>
      <td class="center">${i + 1}</td>
      <td class="center">${esc(formatShortThaiDate(e.date))}</td>
      <td class="center mono">${esc(e.vendorInvoiceNo || "—")}</td>
      <td>${esc(vendorText || "—")}</td>
      <td class="center">${esc(vendorTaxId || e.vendorTaxId || "—")}</td>
      <td class="num">${baht(t.base)}</td>
      <td class="num">${baht(t.vatAmount)}</td>
    </tr>`;
  }).join("");

  const purchaseBaseTotal = vatExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const purchasePage = vatExpenses.length === 0 ? "" : `
  <div class="sheet">
    ${header(company)}
    <div class="title">รายงานภาษีซื้อ</div>
    <div class="subtitle">${esc(monthLabel)}</div>
    <table>
      <thead><tr>
        <th style="width:6%">ลำดับ</th><th style="width:12%">วันที่ใบกำกับภาษี</th><th style="width:18%">เลขที่ใบกำกับภาษี</th>
        <th style="width:28%">ชื่อผู้ขาย</th><th style="width:16%">เลขผู้เสียภาษีผู้ขาย</th>
        <th style="width:10%">มูลค่าสินค้า/บริการ</th><th style="width:10%">ภาษีมูลค่าเพิ่ม</th>
      </tr></thead>
      <tbody>${purchaseRows}</tbody>
      <tfoot><tr><td colspan="5">รวม</td><td class="num">${baht(purchaseBaseTotal)}</td><td class="num">${baht(expenseTotals.vat)}</td></tr></tfoot>
    </table>
  </div>`;

  /* ---------- รายงานหัก ณ ที่จ่าย ---------- */
  const whtRows = whtExpenses.map((e, i) => {
    const t = computeExpenseTotal(e.amount, e.vat, e.whtApplicable, e.whtRate);
    const vendorText = e.vendorId ? supplier(e.vendorId)?.nameTh : e.vendorName;
    const vendorTaxId = e.vendorId ? supplier(e.vendorId)?.taxId : e.vendorTaxId;
    return `<tr>
      <td class="center">${i + 1}</td>
      <td class="center">${esc(formatShortThaiDate(e.date))}</td>
      <td>${esc(vendorText || "—")}</td>
      <td class="center">${esc(vendorTaxId || e.vendorTaxId || "—")}</td>
      <td>${esc(e.category)}</td>
      <td class="center">${e.whtRate}%</td>
      <td class="num">${baht(t.base)}</td>
      <td class="num">${baht(t.whtAmount)}</td>
    </tr>`;
  }).join("");

  const whtPage = whtExpenses.length === 0 ? "" : `
  <div class="sheet">
    ${header(company)}
    <div class="title">รายงานหัก ณ ที่จ่าย</div>
    <div class="subtitle">${esc(monthLabel)}</div>
    <table>
      <thead><tr>
        <th style="width:6%">ลำดับ</th><th style="width:11%">วันที่จ่าย</th><th style="width:24%">ชื่อผู้รับเงิน</th>
        <th style="width:14%">เลขผู้เสียภาษี</th><th style="width:14%">ประเภทเงินได้</th>
        <th style="width:8%">อัตรา</th><th style="width:11%">เงินได้ที่จ่าย</th><th style="width:12%">ภาษีที่หัก</th>
      </tr></thead>
      <tbody>${whtRows}</tbody>
      <tfoot><tr><td colspan="6">รวม</td><td class="num">${baht(whtExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0))}</td><td class="num">${baht(expenseTotals.wht)}</td></tr></tfoot>
    </table>
  </div>`;

  const html = `<!doctype html>
<html lang="th"><head><meta charset="utf-8" />
<title>แพ็คเกจส่งบัญชี — ${esc(monthLabel)}</title>
<style>${PRINT_CSS}</style>
</head><body>
<div class="pv-bar no-print">
  <span class="pv-label">พรีวิวก่อนพิมพ์ — แพ็คเกจส่งบัญชี ${esc(monthLabel)}</span>
  <button onclick="window.print()">🖶 พิมพ์ / บันทึก PDF</button>
</div>
${coverPage}${salesPage}${purchasePage}${whtPage}
<script>
  window.onafterprint = function () { window.close(); };
</script>
</body></html>`;

  const win = window.open("", "_blank");
  if (!win) {
    alert("เบราว์เซอร์บล็อกการเปิดหน้าต่างใหม่ — กรุณาอนุญาตป๊อปอัปสำหรับเว็บนี้แล้วลองอีกครั้ง");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
