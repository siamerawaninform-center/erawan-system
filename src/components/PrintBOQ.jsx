import { useEffect, useRef } from "react";
import logoUrl from "../assets/logo.png";
import { baht, bahtText, formatShortThaiDate, num, computeBoqTotals } from "../lib/format.js";
import { COMPANY_DEFAULT } from "../lib/constants.js";

/* ---------------------------------------------------------
   พิมพ์ BOQ — เปิดหน้าต่างแยกต่างหากเพื่อพิมพ์โดยเฉพาะ (เหมือน PrintDoc)
--------------------------------------------------------- */

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const PRINT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+Thai:wght@600;700&family=Sarabun:wght@400;500;600;700&display=swap');
  *{ box-sizing:border-box; }
  :root{ --ink:#1a1a1a; --maroon:#880808; --steel:#6e6e6e; --steel-light:#9e9e9e; --concrete:#f2f2f2; }
  body{ margin:0; font-family:'Angsana New','AngsanaUPC','TH Sarabun New','TH Sarabun PSK','Sarabun',sans-serif; background:#525659; }

  .pv-bar{ position:sticky; top:0; z-index:10; background:#1a1a1a; color:#fff; padding:10px 16px; display:flex; justify-content:space-between; align-items:center; }
  .pv-bar button{ background:#880808; color:#fff; border:none; padding:8px 18px; border-radius:4px; font-size:13px; cursor:pointer; font-family:'Angsana New','AngsanaUPC','TH Sarabun New','TH Sarabun PSK','Sarabun',sans-serif; }
  .pv-bar button:hover{ background:#a91010; }
  .pv-label{ font-size:13px; }
  .sheet-wrap{ padding:20px 0; }

  .sheet{ background:#fff; width:210mm; min-height:297mm; margin:0 auto 16px; padding:6mm 9mm 5mm; box-shadow:0 4px 24px rgba(0,0,0,.3); position:relative; color:#171717; font-size:17px; font-weight:600; }

  .mono-amt{ font-family:'Angsana New','AngsanaUPC','TH Sarabun New','TH Sarabun PSK','Sarabun',sans-serif; font-size:1em; font-weight:700; }

  .doc-top{ display:flex; justify-content:space-between; align-items:flex-start; gap:16px; }
  .doc-company{ display:flex; gap:12px; align-items:flex-start; }
  .doc-company-text{ font-size:18px; line-height:1.4; }
  .dc-name{ font-family:'Noto Serif Thai',serif; font-weight:700; font-size:18px; margin-bottom:2px; color:var(--ink); }
  .dc-line{ color:#333; font-size:18px; }
  .dc-taxid{ margin-left:14px; }
  .doc-top-rule{ height:3px; background:var(--maroon); margin:3px 0 4px; border-radius:1px; }
  .doc-name-wrap{ display:flex; justify-content:center; margin:0 0 5px; }
  .doc-name{ background:var(--ink); color:#fff; padding:5px 26px; letter-spacing:.03em; font-family:'Noto Serif Thai',serif; font-weight:700; font-size:18px; border-radius:2px; display:inline-block; }

  .boq-info{ font-size:17px; line-height:1.3; margin-bottom:3px; }

  .doc-table{ width:100%; border-collapse:collapse; font-size:18px; margin-bottom:4px; }
  .doc-table th{ background:var(--ink); color:#fff; border:2px solid var(--ink); padding:6px 6px; font-weight:700; font-size:17px; text-align:center; }
  .doc-table td{ border-left:2px solid #333; border-right:2px solid #333; padding:5px 7px; vertical-align:top; }
  .doc-table tbody tr:first-child td{ border-top:2px solid #333; }
  .doc-table tbody tr:last-child td{ border-bottom:2px solid #333; }
  .doc-desc{ white-space:pre-wrap; }
  .doc-num{ text-align:right; font-family:'Angsana New','AngsanaUPC','TH Sarabun New','TH Sarabun PSK','Sarabun',sans-serif; font-size:1em; font-weight:700; }
  .doc-center{ text-align:center; }
  .doc-foot-label{ border:2px solid #333; text-align:right; font-weight:600; padding-right:10px; background:#fafafa; }
  .doc-foot-total{ border:2px solid #333; font-weight:700; background:#fafafa; }

  .boq-subtotal-row td{ background:#fafafa; font-weight:600; border-top:2.5px solid #222 !important; }
  .boq-grand-row td{ background:var(--concrete); font-weight:700; border-top:2.5px solid #222 !important; font-size:18px; }
  .boq-bahttext{ text-align:center; font-style:italic; font-size:17px; padding:4px !important; border:2px solid #333 !important; }
  .boq-note{ font-size:17px; margin:6px 0; color:#333; }

  .doc-sign-grid{ display:flex; justify-content:flex-end; gap:14px; margin-top:14px; font-size:17px; }
  .dsg-sig{ display:flex; flex-direction:column; align-items:center; gap:3px; }
  .dsg-sig-line{ width:180px; border-bottom:2.5px solid #222; height:30px; display:block; }
  .dsg-sig-img{ max-height:44px; max-width:140px; object-fit:contain; margin-bottom:4px; }
  .dsg-paren{ text-align:center; margin-top:2px; }
  .dsg-role{ color:#555; font-weight:600; }

  @media print {
    body{ background:#fff; }
    .no-print{ display:none !important; }
    .sheet-wrap{ padding:0; }
    .sheet{ box-shadow:none; margin:0; width:210mm; min-height:0; height:297mm; }
    .sheet *{ -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
    @page{ size:A4; margin:0; }
  }
`;

export default function PrintBOQ({ boq, data, onClose }) {
  const openedRef = useRef(false);

  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;

    const company = { ...COMPANY_DEFAULT, ...(data.company || {}) };
    const project = data.projects.find((p) => p.id === boq.projectId);
    const signer = data.signers.find((s) => s.id === boq.estimatorId);
    const totals = computeBoqTotals(boq.items, boq.markupPercent, boq.vat, boq.discount);

    const itemRows = (boq.items || []).map((it, idx) => {
      const matTotal = (Number(it.qty) || 0) * (Number(it.materialUnitPrice) || 0);
      const laborTotalLine = (Number(it.qty) || 0) * (Number(it.laborUnitPrice) || 0);
      return `
        <tr>
          <td class="doc-center">${idx + 1}</td>
          <td class="doc-desc">${esc(it.description)}</td>
          <td class="doc-center">${esc(num(it.qty))}</td>
          <td class="doc-center">${esc(it.unit)}</td>
          <td class="doc-num">${esc(baht(it.materialUnitPrice))}</td>
          <td class="doc-num">${esc(baht(matTotal))}</td>
          <td class="doc-num">${esc(baht(it.laborUnitPrice))}</td>
          <td class="doc-num">${esc(baht(laborTotalLine))}</td>
          <td class="doc-num">${esc(baht(matTotal + laborTotalLine))}</td>
        </tr>`;
    }).join("");

    const vatRow = boq.vat ? `
      <tr><td colspan="8" class="doc-foot-label">ภาษีมูลค่าเพิ่ม 7%</td><td class="doc-num">${esc(baht(totals.vatAmount))}</td></tr>` : "";
    const discountRow = Number(boq.discount) > 0 ? `
      <tr><td colspan="8" class="doc-foot-label">ส่วนลด</td><td class="doc-num">${esc(baht(boq.discount))}</td></tr>` : "";
    const noteHtml = boq.note ? `<div class="boq-note"><b>หมายเหตุ:</b> ${esc(boq.note)}</div>` : "";
    const sigHtml = (boq.showSignature && signer?.signatureImage)
      ? `<img src="${esc(signer.signatureImage)}" alt="ลายเซ็น" class="dsg-sig-img" />`
      : `<span class="dsg-sig-line"></span>`;

    const sheetHtml = `
<div class="sheet">
  <div class="doc-top">
    <div class="doc-company">
      <img src="${logoUrl}" width="58" height="58" style="object-fit:contain;display:block" alt="โลโก้" />
      <div class="doc-company-text">
        <div class="dc-name">${esc(company.nameTh)}</div>
        <div class="dc-line">${esc(company.address)}</div>
        <div class="dc-line">โทรศัพท์. ${esc(company.phone)}</div>
        <div class="dc-line">E-mail : ${esc(company.email)}<span class="dc-taxid">เลขประจำตัวผู้เสียภาษี ${esc(company.taxId)}</span></div>
      </div>
    </div>
  </div>
  <div class="doc-top-rule"></div>
  <div class="doc-name-wrap"><div class="doc-name">รายการประมาณราคา (BILL OF QUANTITY)</div></div>

  <div class="boq-info">
    <div><b>โครงการ</b> : ${esc(project?.name || "—")}</div>
    <div><b>สถานที่ก่อสร้าง</b> : ${esc(project?.address || "—")}</div>
    <div><b>เลขที่</b> : <span class="mono-amt">${esc(boq.code)}</span> &nbsp;&nbsp; <b>วันที่</b> : ${esc(formatShortThaiDate(boq.date))}</div>
  </div>

  <table class="doc-table boq-print-table">
    <thead>
      <tr>
        <th rowspan="2">ลำดับ</th><th rowspan="2">รายการ</th><th rowspan="2">ปริมาณ</th><th rowspan="2">หน่วย</th>
        <th colspan="2">ค่าวัสดุ</th><th colspan="2">ค่าแรงงาน</th><th rowspan="2">รวมเป็นเงิน (บาท)</th>
      </tr>
      <tr><th>หน่วยละ</th><th>รวม</th><th>หน่วยละ</th><th>รวม</th></tr>
    </thead>
    <tbody>
      ${itemRows}
      <tr class="boq-subtotal-row">
        <td colspan="4" class="doc-foot-label">รวมค่าก่อสร้าง (ค่าวัสดุ+ค่าแรง)</td>
        <td class="doc-num">${esc(baht(totals.materialTotal))}</td><td></td>
        <td class="doc-num">${esc(baht(totals.laborTotal))}</td><td></td>
        <td class="doc-num">${esc(baht(totals.constructionTotal))}</td>
      </tr>
      <tr><td colspan="8" class="doc-foot-label">ค่าดำเนินการและกำไร (${esc(boq.markupPercent || 0)}%)</td><td class="doc-num">${esc(baht(totals.markupAmount))}</td></tr>
      <tr><td colspan="8" class="doc-foot-label">รวมค่าก่อสร้าง+กำไร</td><td class="doc-num">${esc(baht(totals.afterMarkup))}</td></tr>
      ${vatRow}
      ${discountRow}
      <tr class="boq-grand-row">
        <td colspan="8" class="doc-foot-label">รวมเป็นเงินทั้งสิ้น</td><td class="doc-num doc-foot-total">${esc(baht(totals.total))}</td>
      </tr>
      <tr><td colspan="9" class="boq-bahttext">*** ${esc(bahtText(totals.total))} ***</td></tr>
    </tbody>
  </table>

  ${noteHtml}

  <div class="doc-sign-grid">
    <div class="dsg-sig">
      ${sigHtml}
      <span class="dsg-paren">( ${esc(signer?.name || "—")} )</span>
      <span class="dsg-role">ผู้ประมาณการ</span>
    </div>
  </div>
</div>`;

    const html = `<!doctype html>
<html lang="th"><head><meta charset="utf-8" />
<title>${esc(boq.code)}</title>
<style>${PRINT_CSS}</style>
</head><body>
<div class="pv-bar no-print">
  <span class="pv-label">พรีวิวก่อนพิมพ์ — BOQ</span>
  <button onclick="window.print()">🖶 พิมพ์ / บันทึก PDF</button>
</div>
<div class="sheet-wrap">
${sheetHtml}
</div>
<script>
  window.onafterprint = function () { window.close(); };
</script>
</body></html>`;

    const win = window.open("", "_blank");
    if (!win) {
      alert("เบราว์เซอร์บล็อกการเปิดหน้าต่างใหม่ — กรุณาอนุญาตป๊อปอัปสำหรับเว็บนี้แล้วลองอีกครั้ง");
      onClose();
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();

    onClose();
  }, [boq, data, onClose]);

  return null;
}
