import { useEffect, useRef } from "react";
import logoUrl from "../assets/logo.png";
import { formatShortThaiDate } from "../lib/format.js";
import { COMPANY_DEFAULT } from "../lib/constants.js";

/* ---------------------------------------------------------
   พิมพ์ JSA — เปิดหน้าต่างแยกต่างหากเพื่อพิมพ์โดยเฉพาะ (เหมือน PrintDoc/PrintBOQ)
   ตารางยาวได้หลายหน้าตามธรรมชาติ (ไม่บังคับ 1 หน้า เหมือนเอกสารอื่น)
--------------------------------------------------------- */

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const PRINT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+Thai:wght@600;700&family=Sarabun:wght@400;500;600;700&display=swap');
  *{ box-sizing:border-box; }
  :root{ --ink:#1a1a1a; --maroon:#880808; }
  body{ margin:0; font-family:'Angsana New','AngsanaUPC','TH Sarabun New','TH Sarabun PSK','Sarabun',sans-serif; background:#525659; }

  .pv-bar{ position:sticky; top:0; z-index:10; background:#1a1a1a; color:#fff; padding:10px 16px; display:flex; justify-content:space-between; align-items:center; }
  .pv-bar button{ background:#880808; color:#fff; border:none; padding:8px 18px; border-radius:4px; font-size:13px; cursor:pointer; font-family:'Angsana New','AngsanaUPC','TH Sarabun New','TH Sarabun PSK','Sarabun',sans-serif; }
  .pv-bar button:hover{ background:#a91010; }
  .pv-label{ font-size:13px; }
  .sheet-wrap{ padding:20px 0; }

  .sheet{ background:#fff; width:210mm; min-height:297mm; margin:0 auto 16px; padding:6mm 9mm 5mm; box-shadow:0 4px 24px rgba(0,0,0,.3); position:relative; color:#171717; font-size:17px; font-weight:600; }

  .doc-top{ display:flex; justify-content:space-between; align-items:flex-start; gap:16px; }
  .doc-company{ display:flex; gap:12px; align-items:flex-start; }
  .doc-company-text{ font-size:17px; line-height:1.4; }
  .dc-name{ font-family:'Noto Serif Thai',serif; font-weight:700; font-size:17px; margin-bottom:2px; color:var(--ink); }
  .dc-line{ color:#333; font-size:17px; }
  .doc-top-rule{ height:3px; background:var(--maroon); margin:3px 0 4px; border-radius:1px; }
  .doc-name-wrap{ display:flex; justify-content:center; margin:0 0 5px; }
  .doc-name{ background:var(--ink); color:#fff; padding:5px 26px; letter-spacing:.03em; font-family:'Noto Serif Thai',serif; font-weight:700; font-size:17px; border-radius:2px; display:inline-block; }

  .jsa-meta{ display:grid; grid-template-columns:1fr 1fr; gap:4px 20px; font-size:17px; margin-bottom:4px; }

  .doc-table{ width:100%; border-collapse:collapse; font-size:17px; margin-bottom:4px; }
  .doc-table th{ background:var(--ink); color:#fff; border:2px solid var(--ink); padding:6px 6px; font-weight:700; font-size:12.5px; line-height:1.3; text-align:center; }
  .doc-table td{ border-left:2px solid #333; border-right:2px solid #333; padding:5px 6px; vertical-align:top; }
  .doc-table tbody tr:first-child td{ border-top:2px solid #333; }
  .doc-table tbody tr:last-child td{ border-bottom:2px solid #333; }
  .doc-desc{ white-space:pre-wrap; }
  .doc-center{ text-align:center; }
  .jsa-cell{ font-size:15.5px; }

  .jsa-sign{ margin-top:16px; display:flex; justify-content:flex-end; }
  .plan-sig{ display:flex; flex-direction:column; align-items:center; gap:3px; }
  .dsg-sig-line{ width:180px; border-bottom:2.5px solid #222; height:30px; display:block; }
  .dsg-sig-img{ max-height:44px; max-width:140px; object-fit:contain; margin-bottom:4px; }
  .dsg-paren{ text-align:center; margin-top:2px; }
  .dsg-role{ color:#555; font-weight:600; }

  @media print {
    body{ background:#fff; }
    .no-print{ display:none !important; }
    .sheet-wrap{ padding:0; }
    .sheet{ box-shadow:none; margin:0; width:210mm; min-height:297mm; }
    .sheet + .sheet{ page-break-before:always; }
    .sheet *{ -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
    @page{ size:A4; margin:0; }
    thead{ display:table-header-group; }
  }
`;

export default function PrintJSA({ jsa, data, onClose }) {
  const openedRef = useRef(false);

  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;

    const company = { ...COMPANY_DEFAULT, ...(data.company || {}) };
    const signer = data.signers.find((s) => s.id === jsa.approverId);

    const rowsHtml = (jsa.rows || []).map((r, i) => `
      <tr>
        <td class="doc-center">${i + 1}</td>
        <td class="doc-desc jsa-cell">${esc(r.step)}</td>
        <td class="doc-desc jsa-cell">${esc(r.hazards)}</td>
        <td class="doc-desc jsa-cell">${esc(r.controls)}</td>
        <td class="doc-center jsa-cell">${esc(r.inspector)}</td>
      </tr>`).join("");

    const sigHtml = (jsa.showSignature && signer?.signatureImage)
      ? `<img src="${esc(signer.signatureImage)}" alt="ลายเซ็น" class="dsg-sig-img" />`
      : `<span class="dsg-sig-line"></span>`;

    const sheetHtml = `
<div class="sheet">
  <div class="doc-top">
    <div class="doc-company">
      <img src="${logoUrl}" width="54" height="54" style="object-fit:contain;display:block" alt="โลโก้" />
      <div class="doc-company-text">
        <div class="dc-name">${esc(company.nameTh)}</div>
        <div class="dc-line">${esc(company.address)}</div>
        <div class="dc-line">โทรศัพท์. ${esc(company.phone)} , E-mail : ${esc(company.email)}</div>
        <div class="dc-line">เลขประจำตัวผู้เสียภาษี : ${esc(company.taxId)}</div>
      </div>
    </div>
  </div>
  <div class="doc-top-rule"></div>

  <div class="jsa-meta">
    <div><b>ชื่องาน (Job Title)</b> ${esc(jsa.jobTitle)}</div>
    <div><b>วันที่ (Date)</b> ${esc(formatShortThaiDate(jsa.date))}</div>
    <div><b>สถานที่ (Location)</b> ${esc(jsa.location || "—")}</div>
    <div><b>ผู้ควบคุมงาน (Supervisor)</b> ${esc(jsa.supervisorName || "—")}</div>
  </div>

  <div class="doc-name-wrap"><div class="doc-name">ตารางวิเคราะห์ความปลอดภัยในการทำงาน (JSA Table)</div></div>

  <table class="doc-table jsa-table">
    <thead>
      <tr>
        <th style="width:6%">ลำดับ</th>
        <th style="width:22%">ขั้นตอนการทำงาน<br/>(Task Sequence)</th>
        <th style="width:26%">อันตรายที่อาจเกิดขึ้น<br/>(Potential Hazards)</th>
        <th style="width:32%">มาตรการป้องกันและควบคุม<br/>(Control Measures)</th>
        <th style="width:14%">ผู้ตรวจสอบ<br/>(Check)</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>

  <div class="jsa-sign">
    <div class="plan-sig">
      ${sigHtml}
      <span class="dsg-paren">( ${esc(signer?.name || "—")} )</span>
      <span class="dsg-role">ผู้อนุมัติ/ควบคุมงาน</span>
    </div>
  </div>
</div>`;

    const html = `<!doctype html>
<html lang="th"><head><meta charset="utf-8" />
<title>${esc(jsa.code)}</title>
<style>${PRINT_CSS}</style>
</head><body>
<div class="pv-bar no-print">
  <span class="pv-label">พรีวิวก่อนพิมพ์ — JSA</span>
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
  }, [jsa, data, onClose]);

  return null;
}
