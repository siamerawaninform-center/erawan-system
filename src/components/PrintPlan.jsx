import { useEffect, useRef } from "react";
import { formatShortThaiDate } from "../lib/format.js";
import { COMPANY_DEFAULT } from "../lib/constants.js";
import { buildDayColumns, buildHourColumns, taskColumnRange } from "../lib/gantt.js";

/* ---------------------------------------------------------
   พิมพ์แผนงาน — เปิดหน้าต่างแยกต่างหาก ตั้งกระดาษแนวนอนตรงๆ
   (ไม่ใช้เทคนิคหมุน CSS เพราะเบราว์เซอร์เรนเดอร์ไม่เสถียร)
--------------------------------------------------------- */

const PRINT_CSS = `
  @page { size: A4 landscape; margin: 0; }
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+Thai:wght@600;700&family=Sarabun:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
  *{ box-sizing:border-box; }
  body{ margin:0; font-family:'TH Sarabun New','TH Sarabun PSK','Sarabun',sans-serif; color:#171717; font-size:13.5px; }
  .sheet{ width:297mm; min-height:210mm; padding:12mm 14mm; }
  .plan-title-bar{ font-family:'Noto Serif Thai',serif; font-weight:700; font-size:22px; color:#880808; border-bottom:3px solid #880808; padding-bottom:8px; margin-bottom:12px; }
  .plan-header{ display:flex; justify-content:space-between; font-size:13px; margin-bottom:12px; line-height:1.8; }
  table{ width:100%; border-collapse:collapse; table-layout:fixed; }
  th, td{ border:1px solid #999; text-align:center; }
  thead th{ background:#5c0505; color:#fff; font-size:10px; padding:4px 1px; font-weight:700; }
  .gantt-no{ width:32px; font-size:11.5px; }
  .gantt-desc{ width:220px; text-align:left !important; padding-left:6px !important; }
  .gantt-desc-cell{ text-align:left; padding:4px 6px; font-size:11.5px; }
  .gantt-col{ height:18px; }
  .gantt-fill{ background:#880808; }
  .plan-sign{ margin-top:26px; display:flex; justify-content:flex-end; }
  .plan-sig{ display:flex; flex-direction:column; align-items:center; gap:3px; width:180px; font-size:13px; }
  .sig-line{ width:100%; border-bottom:1px solid #333; height:32px; }
  .sig-img{ max-height:44px; max-width:140px; object-fit:contain; margin-bottom:4px; }
  .sig-role{ color:#555; }
  .pv-bar{ position:sticky; top:0; z-index:10; background:#1a1a1a; color:#fff; padding:10px 16px; display:flex; justify-content:space-between; align-items:center; }
  .pv-bar button{ background:#880808; color:#fff; border:none; padding:8px 18px; border-radius:4px; font-size:13px; cursor:pointer; font-family:'Sarabun',sans-serif; }
  .pv-bar button:hover{ background:#a91010; }
  .pv-label{ font-size:13px; }
  @media print { .no-print{ display:none !important; } }
`;

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default function PrintPlan({ plan, data, onClose }) {
  const openedRef = useRef(false);

  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;

    const company = { ...COMPANY_DEFAULT, ...(data.company || {}) };
    const project = data.projects.find((p) => p.id === plan.projectId);
    const signer = data.signers.find((s) => s.id === plan.preparerId);
    const isHour = plan.unit === "hour";

    const { columns, stepMs, rangeStart } = isHour
      ? buildHourColumns(plan.hourDate, plan.startHour, plan.endHour, plan.stepHours)
      : buildDayColumns(plan.startDate, plan.endDate, plan.stepDays);

    const taskRange = (t) => {
      if (isHour) {
        const base = plan.hourDate + "T00:00:00";
        const s = new Date(base); s.setHours(Number(t.start), 0, 0, 0);
        const e = new Date(base); e.setHours(Number(t.end), 0, 0, 0);
        return taskColumnRange(rangeStart, stepMs, columns.length, s, e);
      }
      return taskColumnRange(rangeStart, stepMs, columns.length, t.start + "T00:00:00", t.end + "T00:00:00");
    };

    const headCells = columns.map((c) => `<th class="gantt-col">${esc(isHour ? c.label : c.day)}</th>`).join("");

    const bodyRows = (plan.tasks || []).map((t, idx) => {
      const { startIdx, endIdx } = taskRange(t);
      const cells = columns.map((c, i) =>
        `<td class="gantt-col ${i >= startIdx && i <= endIdx ? "gantt-fill" : ""}"></td>`
      ).join("");
      return `<tr><td class="gantt-no">${idx + 1}</td><td class="gantt-desc-cell">${esc(t.description || "—")}</td>${cells}</tr>`;
    }).join("");

    const sigBlock = plan.showSignature && signer?.signatureImage
      ? `<img class="sig-img" src="${signer.signatureImage}" alt="ลายเซ็น" />`
      : `<div class="sig-line"></div>`;

    const html = `<!doctype html>
<html lang="th"><head><meta charset="utf-8" />
<title>${esc(plan.code)} — แผนงาน</title>
<style>${PRINT_CSS}</style>
</head><body>
<div class="pv-bar no-print">
  <span class="pv-label">พรีวิวก่อนพิมพ์ — แผนงาน (แนวนอน)</span>
  <button onclick="window.print()">🖶 พิมพ์ / บันทึก PDF</button>
</div>
<div class="sheet">
  <div class="plan-title-bar">${esc(plan.title || "แผนงานโครงการ")}</div>
  <div class="plan-header">
    <div>
      <div><b>PROJECT TITLE</b> &nbsp; ${esc(project?.name || "—")}</div>
      <div><b>PROJECT MANAGER</b> &nbsp; ${esc(plan.managerName || "—")}</div>
    </div>
    <div>
      <div><b>COMPANY NAME</b> &nbsp; ${esc(company.nameTh)}</div>
      <div><b>DATE</b> &nbsp; ${esc(formatShortThaiDate(plan.date))}</div>
    </div>
  </div>
  <table>
    <thead><tr><th class="gantt-no">NO.</th><th class="gantt-desc">DESCRIPTION</th>${headCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <div class="plan-sign">
    <div class="plan-sig">
      ${sigBlock}
      <span>( ${esc(signer?.name || "—")} )</span>
      <span class="sig-role">ผู้จัดทำแผนงาน</span>
    </div>
  </div>
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
  }, [plan, data, onClose]);

  return null;
}
