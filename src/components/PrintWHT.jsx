import logoUrl from "../assets/logo.png";
import { baht, bahtText, formatShortThaiDate, computeExpenseTotal } from "../lib/format.js";
import { COMPANY_DEFAULT, WHT_TABLE_ROWS, WHT_PND_TYPES, WHT_ISSUE_TYPES } from "../lib/constants.js";

/* ---------------------------------------------------------
   หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ)
   ยึดตามแบบฟอร์มจริงของกรมสรรพากร — พิมพ์ 2 ฉบับ (ฉบับที่ 1 / ฉบับที่ 2)
--------------------------------------------------------- */

const PRINT_CSS = `
  @page { size: A4; margin: 0; }
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+Thai:wght@600;700&family=Sarabun:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
  *{ box-sizing:border-box; }
  body{ margin:0; font-family:'TH Sarabun New','TH Sarabun PSK','Sarabun',sans-serif; color:#171717; font-size:14px; font-weight:600; }
  .sheet{ width:210mm; min-height:297mm; padding:12mm 14mm 10mm; page-break-after:always; }
  .sheet:last-child{ page-break-after:auto; }
  .copy-tag{ text-align:right; font-size:10px; margin-bottom:4px; }
  .hdr{ display:flex; align-items:center; gap:10px; margin-bottom:10px; }
  .hdr img{ width:38px; height:38px; object-fit:contain; }
  .hdr-name{ font-family:'Noto Serif Thai',serif; font-weight:700; font-size:13px; }
  .hdr-meta{ font-size:10.5px; color:#444; }
  .title-wrap{ text-align:center; margin-bottom:2px; }
  .title{ font-family:'Noto Serif Thai',serif; font-weight:700; font-size:15px; }
  .subtitle{ text-align:center; font-size:10px; margin-bottom:4px; }
  .copy-note{ text-align:center; font-size:9px; color:#555; margin-bottom:10px; }
  .booknum{ display:flex; justify-content:flex-end; gap:16px; font-size:10px; margin-bottom:8px; }
  .party{ border:1px solid #999; padding:8px 10px; margin-bottom:8px; font-size:11.5px; line-height:2; }
  .party b{ color:#000; }
  .dotted{ border-bottom:1px dotted #999; display:inline-block; min-width:60%; }
  table.wht{ width:100%; border-collapse:collapse; font-size:11px; margin-top:6px; }
  table.wht th{ border:1px solid #999; padding:4px; background:#f2f2f2; font-weight:600; }
  table.wht td{ border:1px solid #999; padding:4px 6px; vertical-align:top; }
  .num{ text-align:right; font-family:'IBM Plex Mono',monospace; white-space:nowrap; }
  .center{ text-align:center; }
  .total-row td{ font-weight:700; background:#f8f8f8; }
  .bahttext-row td{ font-style:italic; font-size:9.5px; }
  .pnd-row{ font-size:9.5px; margin-top:8px; display:flex; flex-wrap:wrap; gap:10px; align-items:center; }
  .pnd-row b{ margin-right:4px; }
  .chk{ display:inline-flex; align-items:center; gap:3px; margin-right:8px; white-space:nowrap; }
  .box{ width:10px; height:10px; border:1px solid #333; display:inline-flex; align-items:center; justify-content:center; font-size:8px; }
  .payer-row{ font-size:9.5px; margin-top:8px; }
  .fund-row{ font-size:9.5px; margin-top:6px; }
  .certify{ font-size:10px; margin-top:16px; text-align:center; }
  .sign-line{ margin-top:34px; text-align:center; font-size:10px; }
  .sig-under{ border-bottom:1px solid #333; width:220px; height:34px; margin:0 auto 6px; display:flex; align-items:flex-end; justify-content:center; }
  .sig-img{ max-height:40px; max-width:170px; object-fit:contain; }
  .warn{ margin-top:16px; font-size:8.5px; color:#555; border-top:1px solid #ddd; padding-top:8px; line-height:1.7; }
  .note{ font-size:8.5px; color:#999; margin-top:8px; }
  .pv-bar{ position:sticky; top:0; z-index:10; background:#1a1a1a; color:#fff; padding:10px 16px; display:flex; justify-content:space-between; align-items:center; }
  .pv-bar button{ background:#880808; color:#fff; border:none; padding:8px 18px; border-radius:4px; font-size:13px; cursor:pointer; font-family:'Sarabun',sans-serif; }
  .pv-bar button:hover{ background:#a91010; }
  .pv-label{ font-size:13px; }
  @media print { .no-print{ display:none !important; } }
`;

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function chk(label, checked) {
  return `<span class="chk"><span class="box">${checked ? "✓" : ""}</span>${esc(label)}</span>`;
}

function buildSheet({ copyLabel, copyNote, company, vendorName, vendorAddress, vendorTaxId, expense, t, signer }) {
  const rows = WHT_TABLE_ROWS.map((r) => {
    const match = String(expense.whtIncomeRow) === String(r.row);
    return `<tr>
      <td>${esc(r.label)}</td>
      <td class="center">${match ? esc(formatShortThaiDate(expense.date)) : ""}</td>
      <td class="num">${match ? baht(t.base) : ""}</td>
      <td class="num">${match ? baht(t.whtAmount) : ""}</td>
    </tr>`;
  }).join("");

  const sigBlock = expense.showSignature && signer?.signatureImage
    ? `<img class="sig-img" src="${signer.signatureImage}" alt="ลายเซ็น" />`
    : "";

  return `
  <div class="sheet">
    <div class="copy-tag">${esc(copyLabel)}</div>
    <div class="hdr">
      <img src="${logoUrl}" alt="โลโก้" />
      <div>
        <div class="hdr-name">${esc(company.nameTh)}</div>
        <div class="hdr-meta">${esc(company.address)} · โทร ${esc(company.phone)}</div>
      </div>
    </div>

    <div class="title-wrap"><div class="title">หนังสือรับรองการหักภาษี ณ ที่จ่าย</div></div>
    <div class="subtitle">ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</div>
    <div class="copy-note">${esc(copyNote)}</div>

    <div class="booknum">
      <span>เล่มที่ <span class="dotted" style="min-width:60px;display:inline-block;">${esc(expense.bookNo || "—")}</span></span>
      <span>เลขที่ <span class="dotted" style="min-width:100px;display:inline-block;">${esc(expense.whtCertNo || "—")}</span></span>
    </div>

    <div class="party">
      <b>ผู้มีหน้าที่หักภาษี ณ ที่จ่าย</b><br/>
      ชื่อ ${esc(company.nameTh)}<br/>
      ที่อยู่ ${esc(company.address)}<br/>
      เลขประจำตัวผู้เสียภาษีอากร ${esc(company.taxId)}
    </div>

    <div class="party">
      <b>ผู้ถูกหักภาษี ณ ที่จ่าย</b><br/>
      ชื่อ ${esc(vendorName)}<br/>
      ที่อยู่ ${esc(vendorAddress || "—")}<br/>
      เลขประจำตัวผู้เสียภาษีอากร ${esc(vendorTaxId || "—")}
    </div>

    <table class="wht">
      <thead><tr>
        <th style="width:46%">ประเภทเงินได้พึงประเมินที่จ่าย</th>
        <th style="width:16%">วัน เดือน หรือปีภาษีที่จ่าย</th>
        <th style="width:19%">จำนวนเงินที่จ่าย</th>
        <th style="width:19%">ภาษีที่หักและนำส่งไว้</th>
      </tr></thead>
      <tbody>
        ${rows}
        <tr class="total-row">
          <td colspan="2">รวมเงินที่จ่ายและภาษีที่หักนำส่ง</td>
          <td class="num">${baht(t.base)}</td>
          <td class="num">${baht(t.whtAmount)}</td>
        </tr>
        <tr class="bahttext-row"><td colspan="4">รวมเงินภาษีที่หักนำส่ง (ตัวอักษร) ${esc(bahtText(t.whtAmount))}</td></tr>
      </tbody>
    </table>

    <div class="pnd-row">
      <b>ลำดับที่ในแบบ</b>
      ${WHT_PND_TYPES.map((p) => chk(p, expense.pndType === p)).join("")}
    </div>

    <div class="payer-row">
      <b>ผู้จ่ายเงิน</b>
      ${WHT_ISSUE_TYPES.map((x) => chk(x, expense.issueType === x)).join("")}
    </div>

    <div class="fund-row">
      เงินที่จ่ายเข้า กบข./กสจ./กองทุนสงเคราะห์ครูโรงเรียนเอกชน .......... บาท
      กองทุนประกันสังคม .......... บาท กองทุนสำรองเลี้ยงชีพ .......... บาท
    </div>

    <div class="certify">
      ขอรับรองว่าข้อความและตัวเลขดังกล่าวข้างต้นถูกต้องตรงกับความจริงทุกประการ
    </div>

    <div class="sign-line">
      <div class="sig-under">${sigBlock}</div>
      ลงชื่อ ........................................................ ผู้จ่ายเงิน<br/>
      ( ${esc(signer?.name || "—")} )<br/>
      วันที่ ${esc(formatShortThaiDate(expense.date))}
    </div>

    <div class="warn">
      <b>คำเตือน</b> ผู้มีหน้าที่ออกหนังสือรับรองการหักภาษี ณ ที่จ่าย ฝ่าฝืนไม่ปฏิบัติตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร
      ต้องรับโทษทางอาญาตามมาตรา 35 แห่งประมวลรัษฎากร
    </div>
    <div class="note">
      เอกสารนี้จัดทำโดยระบบภายในบริษัท — กรุณาตรวจสอบความถูกต้องของประเภทเงินได้ อัตราภาษี และแบบ ภ.ง.ด. ที่เลือก กับนักบัญชีก่อนนำไปใช้ยื่นภาษีจริง
    </div>
  </div>`;
}

export function openWhtCertPrint({ expense, data, supplier }) {
  const company = { ...COMPANY_DEFAULT, ...(data.company || {}) };
  const vendor = expense.vendorId ? supplier(expense.vendorId) : null;
  const vendorName = vendor?.nameTh || expense.vendorName || "—";
  const vendorAddress = vendor?.address || "";
  const vendorTaxId = vendor?.taxId || expense.vendorTaxId || "";
  const signer = data.signers.find((s) => s.id === expense.signerId);
  const t = computeExpenseTotal(expense.amount, expense.vat, expense.whtApplicable, expense.whtRate);

  const ctx = { company, vendorName, vendorAddress, vendorTaxId, expense, t, signer };

  const sheet1 = buildSheet({
    ...ctx,
    copyLabel: "ฉบับที่ 1",
    copyNote: "(สำหรับผู้ถูกหักภาษี ณ ที่จ่าย ใช้แนบพร้อมกับแบบแสดงรายการภาษี)",
  });
  const sheet2 = buildSheet({
    ...ctx,
    copyLabel: "ฉบับที่ 2",
    copyNote: "(สำหรับผู้ถูกหักภาษี ณ ที่จ่าย เก็บไว้เป็นหลักฐาน)",
  });

  const html = `<!doctype html>
<html lang="th"><head><meta charset="utf-8" />
<title>${esc(expense.whtCertNo || "50ทวิ")}</title>
<style>${PRINT_CSS}</style>
</head><body>
<div class="pv-bar no-print">
  <span class="pv-label">พรีวิวก่อนพิมพ์ — หนังสือรับรองหัก ณ ที่จ่าย</span>
  <button onclick="window.print()">🖶 พิมพ์ / บันทึก PDF</button>
</div>
${sheet1}${sheet2}
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
