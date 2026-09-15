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
  @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&family=Sarabun:wght@400;500;600;700&display=swap');
  *{ box-sizing:border-box; }
  /* บังคับให้เบราว์เซอร์พิมพ์สีพื้นหลัง (เช่นแถบสีแดงในตาราง) เสมอ — ปกติเบราว์เซอร์จะซ่อนสีพื้นหลังตอนพิมพ์
     จนกว่าจะไปติ๊ก "Background graphics" เองใน print dialog ซึ่งพึ่งพาไม่ได้ ต้องบังคับด้วย CSS ตรงนี้แทน */
  *{ -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; color-adjust:exact !important; }
  body{ margin:0; font-family:'Chakra Petch','Angsana New','AngsanaUPC','TH Sarabun New','TH Sarabun PSK','Sarabun',sans-serif; color:#171717; font-size:4px; font-weight:600; }
  .sheet{ width:297mm; padding:8mm 14mm; transform-origin:top left; }
  .plan-title-bar{ font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:22px; color:#880808; border-bottom:3px solid #880808; padding-bottom:5px; margin-bottom:8px; }
  .plan-header{ display:flex; justify-content:space-between; font-size:11.5px; margin-bottom:6px; line-height:1.4; }
  table{ width:100%; border-collapse:collapse; table-layout:fixed; }
  th, td{ border:1px solid #999; text-align:center; }
  thead th{ background:#5c0505; color:#fff; font-size:11.5px; padding:3px 1px; font-weight:700; }
  .gantt-month{ font-size:11.5px; letter-spacing:.03em; }
  /* เส้นกั้นหนาสีดำ เฉพาะตรงจุดที่ขึ้นเดือนใหม่เท่านั้น — ลากยาวทะลุทุกแถวของตาราง จุดอื่นไม่ขีดเพิ่ม */
  th.month-start, td.month-start{ border-left:3px solid #000 !important; }
  .gantt-no{ width:32px; font-size:11.5px; }
  .gantt-desc{ width:220px; text-align:left !important; padding-left:6px !important; }
  .gantt-desc-cell{ text-align:left; padding:3px 6px; font-size:11.5px; vertical-align:middle; }
  .gantt-col{ height:16px; vertical-align:middle; }
  .gantt-fill{ background:#880808; }
  .plan-sign{ margin-top:10px; display:flex; justify-content:flex-end; }
  .plan-sig{ display:flex; flex-direction:column; align-items:center; gap:2px; width:180px; font-size:11.5px; }
  .sig-line{ width:100%; border-bottom:1px solid #333; height:22px; }
  .sig-img{ max-height:34px; max-width:130px; object-fit:contain; margin-bottom:2px; }
  .sig-role{ color:#555; }
  .pv-bar{ position:sticky; top:0; z-index:10; background:#1a1a1a; color:#fff; padding:10px 16px; display:flex; justify-content:space-between; align-items:center; }
  .pv-bar button{ background:#880808; color:#fff; border:none; padding:8px 18px; border-radius:4px; font-size:13px; cursor:pointer; font-family:'Chakra Petch','Angsana New','AngsanaUPC','TH Sarabun New','TH Sarabun PSK','Sarabun',sans-serif; }
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

    // จุดที่ขึ้นเดือนใหม่ (เทียบกับคอลัมน์ก่อนหน้า) — ใช้ตีเส้นหนาทะลุทั้งตาราง เฉพาะโหมดรายวันที่มีวันที่จริงต่อคอลัมน์
    const monthStart = columns.map((c, i) =>
      !isHour && i > 0 &&
      (c.date.getMonth() !== columns[i - 1].date.getMonth() || c.date.getFullYear() !== columns[i - 1].date.getFullYear())
    );

    const headCells = columns.map((c, i) => `<th class="gantt-col${monthStart[i] ? " month-start" : ""}">${esc(isHour ? c.label : c.day)}</th>`).join("");

    // แถวเดือน (รวมช่องวันที่อยู่เดือนเดียวกันไว้ด้วยกันด้วย colspan) — เฉพาะโหมดรายวัน
    // ลิงค์ตรงจากช่วงวันที่/ระยะห่างคอลัมน์ที่กรอกไว้ในแผนงาน (buildDayColumns) ไม่ใช่ค่าตายตัว
    let monthHeadCells = "";
    if (!isHour && columns.length > 0) {
      const cells = [];
      let i = 0;
      while (i < columns.length) {
        let span = 1;
        while (
          i + span < columns.length &&
          columns[i + span].date.getMonth() === columns[i].date.getMonth() &&
          columns[i + span].date.getFullYear() === columns[i].date.getFullYear()
        ) {
          span++;
        }
        const col = columns[i];
        const yearBE = col.date.getFullYear() + 543;
        cells.push(`<th colspan="${span}" class="gantt-month${monthStart[i] ? " month-start" : ""}">${esc(col.monthLabel)} ${yearBE}</th>`);
        i += span;
      }
      monthHeadCells = cells.join("");
    }

    const bodyRows = (plan.tasks || []).map((t, idx) => {
      const { startIdx, endIdx } = taskRange(t);
      const cells = columns.map((c, i) =>
        `<td class="gantt-col${monthStart[i] ? " month-start" : ""} ${i >= startIdx && i <= endIdx ? "gantt-fill" : ""}"></td>`
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
    <thead>
      ${monthHeadCells ? `<tr><th class="gantt-no" rowspan="2">NO.</th><th class="gantt-desc" rowspan="2">DESCRIPTION</th>${monthHeadCells}</tr>` : ""}
      <tr>${monthHeadCells ? "" : `<th class="gantt-no">NO.</th><th class="gantt-desc">DESCRIPTION</th>`}${headCells}</tr>
    </thead>
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
  // ทำให้ทุกแถวของตารางสูงเท่ากันหมด โดยยึดแถวที่สูงที่สุด (เกิดจากรายละเอียดงานยาวขึ้นหลายบรรทัด)
  // วัดความสูงจริงหลังเบราว์เซอร์ render เสร็จ (แม่นกว่าคำนวณจากความยาวตัวหนังสือ)
  function equalizeRowHeights() {
    var rows = document.querySelectorAll("tbody tr");
    if (!rows.length) return;
    rows.forEach(function (r) { r.style.height = "auto"; });
    var maxH = 0;
    rows.forEach(function (r) { maxH = Math.max(maxH, r.getBoundingClientRect().height); });
    rows.forEach(function (r) { r.style.height = maxH + "px"; });
  }
  // ย่อทั้งแผ่นให้พอดี A4 แนวนอน 1 หน้าเสมอ ไม่ว่าจำนวนวัน/รายการงานจะเยอะแค่ไหน
  // วัดความสูงจริงของเนื้อหาเทียบกับความสูงกระดาษ แล้วคำนวณสัดส่วนย่อที่พอดีเป๊ะ
  function fitToOnePage() {
    var sheet = document.querySelector(".sheet");
    if (!sheet) return;
    sheet.style.transform = "none";
    sheet.style.width = "297mm";
    var pxPerMm = 96 / 25.4;
    var pageHeightPx = 210 * pxPerMm; // A4 แนวนอน สูง 210mm, margin ตั้งเป็น 0 แล้ว
    var contentHeightPx = sheet.scrollHeight;
    if (contentHeightPx > pageHeightPx) {
      var scale = (pageHeightPx / contentHeightPx) * 0.985; // เผื่อ margin กันขอบตัดพอดี
      sheet.style.transform = "scale(" + scale + ")";
      sheet.style.width = (100 / scale) + "%"; // ชดเชยความกว้างที่หายไปจากการย่อ ให้กว้างเต็มหน้ากระดาษเหมือนเดิม
    }
  }
  function layoutPrintPage() {
    equalizeRowHeights();
    fitToOnePage();
  }
  window.addEventListener("load", function () {
    layoutPrintPage();
    // เรียกซ้ำอีกครั้งหลังฟอนต์ Google Fonts โหลดเสร็จจริง (กันกรณี metric ขยับหลังสลับฟอนต์)
    setTimeout(layoutPrintPage, 250);
  });
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
