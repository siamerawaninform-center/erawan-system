import { useEffect, useRef } from "react";
import logoUrl from "../assets/logo.png";
import {
  baht, bahtText, formatShortThaiDate, computeFinTotal, lineTotal, num,
} from "../lib/format.js";
import { buildDocCode } from "../lib/docNumber.js";
import { COMPANY_DEFAULT, FIN_TYPE_EN, PAYMENT_METHODS } from "../lib/constants.js";

/* ---------------------------------------------------------
   พิมพ์เอกสารขาย (ใบเสนอราคา/วางบิล/แจ้งหนี้/กำกับภาษี/เสร็จ)
   เปิดหน้าต่างแยกต่างหากเพื่อพิมพ์โดยเฉพาะ — เหมือนแผนงาน/แพ็คเกจส่งบัญชี/50ทวิ
   (ไม่ใช้เทคนิคซ่อนเมนูด้วย CSS เพราะเบราว์เซอร์คำนวณจำนวนหน้าพิมพ์ผิดพลาด)
--------------------------------------------------------- */

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const PRINT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+Thai:wght@600;700&family=Sarabun:wght@400;500;600;700&display=swap');
  *{ box-sizing:border-box; }
  :root{ --ink:#1a1a1a; --maroon:#880808; --steel:#6e6e6e; --steel-light:#9e9e9e; --concrete:#f2f2f2; }
  body{ margin:0; font-family:'TH Sarabun New','TH Sarabun PSK','Sarabun',sans-serif; background:#525659; }

  .pv-bar{ position:sticky; top:0; z-index:10; background:#1a1a1a; color:#fff; padding:10px 16px; display:flex; justify-content:space-between; align-items:center; gap:14px; flex-wrap:wrap; }
  .pv-bar button{ background:#880808; color:#fff; border:none; padding:8px 18px; border-radius:4px; font-size:13px; cursor:pointer; font-family:'Sarabun',sans-serif; }
  .pv-bar button:hover{ background:#a91010; }
  .pv-label{ font-size:13px; }
  .pv-bar select{ padding:6px 10px; font-size:12.5px; border-radius:4px; border:none; }
  .sheet-wrap{ padding:20px 0; }

  .sheet{ background:#fff; width:210mm; min-height:297mm; margin:0 auto 16px; padding:7mm 10mm 6mm; box-shadow:0 4px 24px rgba(0,0,0,.3); position:relative; color:#171717; font-size:18px; font-weight:600; }

  .mono-code{ font-family:'TH Sarabun New','TH Sarabun PSK','Sarabun',sans-serif; font-size:12.5px; color:var(--maroon); font-weight:700; }
  .mono-amt{ font-family:'TH Sarabun New','TH Sarabun PSK','Sarabun',sans-serif; font-size:1em; font-weight:700; }
  .mono-amt-lg{ font-family:'TH Sarabun New','TH Sarabun PSK','Sarabun',sans-serif; font-size:1.25em; font-weight:700; color:var(--maroon); }

  .doc-ribbon{ position:absolute; top:0; right:0; background:var(--maroon); color:#fff; font-weight:700; letter-spacing:.04em; padding:9px 24px; font-size:16px; border-bottom-left-radius:6px; }
  .doc-top{ display:flex; justify-content:space-between; align-items:flex-start; gap:16px; padding-right:130px; }
  .doc-company{ display:flex; gap:12px; align-items:flex-start; }
  .doc-company-text{ font-size:18px; line-height:1.4; }
  .dc-name{ font-family:'Noto Serif Thai',serif; font-weight:700; font-size:18px; margin-bottom:2px; color:var(--ink); }
  .dc-line{ color:#333; font-size:18px; }
  .dc-taxid{ margin-left:14px; }
  .doc-top-rule{ height:3px; background:var(--maroon); margin:4px 0 5px; border-radius:1px; }
  .doc-name-wrap{ display:flex; justify-content:center; margin:0 0 6px; }
  .doc-name{ background:var(--ink); color:#fff; padding:5px 26px; letter-spacing:.03em; font-family:'Noto Serif Thai',serif; font-weight:700; font-size:18px; border-radius:2px; display:inline-block; }

  .doc-party{ display:flex; border:2px solid #333; border-radius:3px; margin-bottom:6px; font-size:18px; overflow:hidden; }
  .dp-left{ flex:1.6; padding:10px 14px; border-right:2px solid #333; display:flex; flex-direction:column; gap:4px; background:#fff; }
  .dp-right{ flex:1; padding:10px 14px; display:flex; flex-direction:column; gap:6px; background:#fafafa; }
  .dp-row{ display:grid; grid-template-columns:70px 1fr 90px 1fr; gap:4px; align-items:baseline; }
  .dp-row-block{ grid-template-columns:70px 1fr; }
  .dp-k{ color:#555; font-weight:500; }
  .dp-k2{ color:#555; font-weight:500; }
  .dp-v{ font-weight:600; }
  .dp-strong{ font-weight:700; color:var(--ink); }
  .dp-row2{ display:flex; justify-content:space-between; gap:8px; }
  .dp-sig-inline{ margin-top:14px; display:flex; align-items:baseline; gap:6px; font-size:18px; }
  .dp-sig-line-inline{ flex:1; border-bottom:1px dotted #999; min-width:40px; }
  .dp-sig-name{ white-space:nowrap; }

  .doc-table{ width:100%; border-collapse:collapse; font-size:18px; margin-bottom:4px; }
  .doc-table th{ background:var(--ink); color:#fff; border:2px solid var(--ink); padding:10px 8px; font-weight:700; font-size:20px; text-align:center; }
  .doc-table td{ border-left:2px solid #333; border-right:2px solid #333; padding:9px 8px; vertical-align:top; }
  .doc-table tbody tr:first-child td{ border-top:2px solid #333; }
  .doc-table-fill tbody{ border-bottom:2px solid #333; }
  .doc-table tbody tr:last-child td{ border-bottom:2px solid #333; }
  .doc-table tfoot tr:last-child td{ border-bottom:2px solid #333 !important; }
  .doc-blank-row td{ height:22px; border-top:1.5px solid #ccc; }
  .doc-desc{ white-space:pre-wrap; }
  .doc-num{ text-align:right; font-family:'TH Sarabun New','TH Sarabun PSK','Sarabun',sans-serif; font-size:1em; font-weight:700; }
  .doc-center{ text-align:center; }
  .doc-foot-empty{ border:2px solid #333; }
  .doc-foot-label{ border:2px solid #333; text-align:right; font-weight:600; padding-right:10px; background:#fafafa; }
  .doc-foot-total{ border:2px solid #333; font-weight:700; background:#fafafa; }

  .payment-terms-box{ border:2px solid #333; border-radius:3px; padding:8px 12px; margin-bottom:10px; font-size:18px; background:#fafafa; }
  .payment-terms-title{ font-weight:700; margin-bottom:3px; }
  .payment-terms-body{ white-space:pre-wrap; line-height:1.6; color:#333; }

  .doc-footer-grid{ display:flex; justify-content:space-between; gap:16px; margin-bottom:4px; font-size:18px; }
  .dfg-left{ flex:1.4; display:flex; flex-direction:column; justify-content:flex-end; gap:8px; }
  .dfg-cheque{ line-height:1.5; color:#444; }
  .dfg-bahttext{ border:2px solid #333; border-radius:2px; padding:6px 10px; font-weight:600; text-align:center; background:#fafafa; }
  .dfg-right{ flex:1; display:flex; flex-direction:column; gap:4px; }
  .dfg-right-full{ flex:1; max-width:320px; margin-left:auto; }
  .dfg-row{ display:flex; justify-content:space-between; padding:2px 0; }
  .dfg-total{ border-top:3px solid var(--ink); padding-top:6px; font-weight:700; font-size:20px; color:var(--maroon); }

  .dsbn-single{ max-width:340px; margin-top:22px; }
  .dsbn-inname{ color:#555; margin-bottom:26px; font-weight:500; }
  .dsbn-line{ border-bottom:2.5px solid #222; height:1px; margin-bottom:8px; }
  .dsbn-labels{ font-weight:600; margin-bottom:14px; }
  .dsbn-daterow{ display:flex; gap:20px; }
  .dsbn-subrow{ flex:1; display:flex; align-items:baseline; gap:6px; white-space:nowrap; }
  .dsbn-subline{ flex:1; border-bottom:2px dotted #666; min-height:12px; }

  .doc-sign-grid{ display:flex; justify-content:space-between; gap:14px; margin-top:16px; font-size:18px; }
  .dsg-col{ flex:1; display:flex; flex-direction:column; gap:4px; }
  .dsg-note{ color:#333; }
  .dsg-field{ display:flex; align-items:baseline; gap:5px; margin-top:6px; }
  .dsg-line{ flex:1; border-bottom:2px dotted #444; min-width:20px; }
  .dsg-line-sm{ flex:0.6; }
  .dsg-paren{ text-align:center; margin-top:2px; }
  .dsg-check{ display:flex; align-items:baseline; gap:6px; margin-top:4px; }
  .dsg-box{ width:13px; height:13px; border:1.5px solid #222; display:inline-flex; align-items:center; justify-content:center; font-size:9px; flex-shrink:0; }
  .dsg-box-checked{ background:#eee; }
  .dsg-col-sign{ justify-content:flex-end; gap:22px; }
  .dsg-sig{ display:flex; flex-direction:column; align-items:center; gap:3px; }
  .dsg-sig-line{ width:100%; border-bottom:2.5px solid #222; height:30px; }
  .dsg-role{ color:#555; font-weight:600; }

  .quote-sign-grid{ display:flex; justify-content:space-between; gap:50px; margin-top:26px; }
  .quote-sig-col{ flex:1; text-align:center; }
  .quote-sig-inname{ font-size:18px; color:#555; margin-bottom:26px; font-weight:600; }
  .quote-sig-line{ border-bottom:3px solid #222; height:68px; margin-bottom:10px; }
  .quote-sig-imgwrap{ height:68px; margin-bottom:10px; display:flex; align-items:flex-end; justify-content:center; border-bottom:3px solid #222; }
  .quote-sig-img{ max-height:64px; max-width:240px; object-fit:contain; }
  .quote-sig-name{ font-size:18px; font-weight:700; color:#171717; margin-bottom:5px; font-family:'Noto Serif Thai',serif; }
  .quote-sig-blank{ display:flex; align-items:center; justify-content:center; }
  .quote-sig-blank-space{ display:inline-block; width:230px; }
  .quote-sig-role{ font-size:18px; color:var(--maroon); font-weight:700; letter-spacing:.02em; margin-bottom:8px; }
  .quote-sig-date{ font-size:18px; color:#777; }

  @media print {
    body{ background:#fff; }
    .no-print{ display:none !important; }
    .sheet-wrap{ padding:0; }
    .sheet{ box-shadow:none; margin:0; width:210mm; min-height:0; height:297mm; page-break-after:always; }
    .sheet:last-child{ page-break-after:auto; }
    .sheet *{ -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
    @page{ size:A4; margin:0; }
  }
`;

function buildDocPageHtml({ record, printType, copyType, data }) {
  const company = { ...COMPANY_DEFAULT, ...(data.company || {}) };
  const customer = data.customers.find((c) => c.id === record.customerId);
  const project = data.projects.find((p) => p.id === record.projectId);
  const issuerSigner = data.signers.find((s) => s.name === record.signerIssuer);
  const totals = computeFinTotal(record.items, record.vat, record.discount);

  const isBilling = printType === "ใบวางบิล";
  const isReceipt = printType === "ใบเสร็จรับเงิน";
  const isQuote = printType === "ใบเสนอราคา";

  const docCode = record.kind === "salesSet"
    ? buildDocCode(printType, record.period, record.running)
    : record.code;
  const taxInvoiceCode = record.kind === "salesSet"
    ? buildDocCode("ใบกำกับภาษี", record.period, record.running)
    : "";
  const custName = customer?.nameTh || record.customerName || "";
  const custBranch = customer?.branch ? ` สาขา ${customer.branch}` : "";
  const ribbonLabel = copyType === "ต้นฉบับ (ORIGINAL)" ? "ต้นฉบับ" : "สำเนา";

  let tableHtml;
  if (isBilling) {
    const blankRows = Array.from({ length: 6 })
      .map(() => `<tr class="doc-blank-row"><td></td><td></td><td></td><td></td><td></td></tr>`).join("");
    tableHtml = `
      <table class="doc-table doc-table-fill">
        <thead><tr>
          <th style="width:10%">ลำดับที่</th><th style="width:20%">วันที่เอกสาร</th>
          <th style="width:28%">เลขที่เอกสาร</th><th style="width:22%">จำนวนเงิน</th><th style="width:20%">หมายเหตุ</th>
        </tr></thead>
        <tbody>
          <tr>
            <td class="doc-center">1</td>
            <td class="doc-center">${esc(formatShortThaiDate(record.date))}</td>
            <td class="doc-center mono-amt">${esc(taxInvoiceCode)}</td>
            <td class="doc-num">${esc(baht(totals.total))}</td>
            <td class="doc-center">${esc(record.refPO || "")}</td>
          </tr>
          ${blankRows}
        </tbody>
        <tfoot><tr>
          <td colspan="3" class="doc-foot-empty"></td>
          <td class="doc-foot-label">รวมเงินทั้งสิ้น</td>
          <td class="doc-num doc-foot-total">${esc(baht(totals.total))}</td>
        </tr></tfoot>
      </table>`;
  } else {
    const itemRows = (record.items || []).map((it, i) => `
      <tr>
        <td class="doc-center">${i + 1}</td>
        <td class="doc-desc">${esc(it.desc)}</td>
        <td class="doc-center">${esc(num(it.qty))} ${esc(it.unit)}</td>
        <td class="doc-num">${esc(baht(it.price))}</td>
        <td class="doc-num">${esc(baht(it.discount))}</td>
        <td class="doc-num">${esc(baht(lineTotal(it)))}</td>
      </tr>`).join("");
    const blankCount = Math.max(0, 4 - (record.items?.length || 0));
    const blankRows = Array.from({ length: blankCount })
      .map(() => `<tr class="doc-blank-row"><td></td><td></td><td></td><td></td><td></td><td></td></tr>`).join("");
    tableHtml = `
      <table class="doc-table doc-table-fill">
        <thead><tr>
          <th style="width:8%">ลำดับที่</th><th style="width:42%">รายการ</th><th style="width:10%">จำนวน</th>
          <th style="width:14%">ราคา / หน่วย</th><th style="width:12%">ส่วนลด</th><th style="width:14%">จำนวนเงิน</th>
        </tr></thead>
        <tbody>${itemRows}${blankRows}</tbody>
      </table>`;
  }

  const paymentTermsHtml = (isQuote && record.paymentTerms) ? `
    <div class="payment-terms-box">
      <div class="payment-terms-title">เงื่อนไขการชำระเงิน</div>
      <div class="payment-terms-body">${esc(record.paymentTerms)}</div>
    </div>` : "";

  let footerHtml = "";
  if (!isBilling) {
    const leftHtml = !isQuote ? `
      <div class="dfg-left">
        <div class="dfg-cheque">
          <div>กรณีสั่งจ่ายเป็นเช็ค</div>
          <div>${esc(company.chequeNote)}</div>
        </div>
        <div class="dfg-bahttext">( ${esc(bahtText(totals.total))} )</div>
      </div>` : "";
    footerHtml = `
      <div class="doc-footer-grid">
        ${leftHtml}
        <div class="dfg-right ${isQuote ? "dfg-right-full" : ""}">
          <div class="dfg-row"><span>ยอดรวม</span><span class="mono-amt">${esc(baht(totals.subtotal))}</span></div>
          <div class="dfg-row"><span>ส่วนลด</span><span class="mono-amt">${esc(baht(totals.discount))}</span></div>
          <div class="dfg-row"><span>ราคาสุทธิหลังหักส่วนลด</span><span class="mono-amt">${esc(baht(totals.afterDiscount))}</span></div>
          <div class="dfg-row"><span>ภาษีมูลค่าเพิ่ม ${record.vat ? "7.0%" : "—"}</span><span class="mono-amt">${esc(baht(totals.vatAmount))}</span></div>
          <div class="dfg-row dfg-total"><span>จำนวนเงินรวมทั้งสิ้น</span><span class="mono-amt">${esc(baht(totals.total))}</span></div>
        </div>
      </div>`;
  }

  let signHtml;
  if (isBilling) {
    signHtml = `
      <div class="dsbn-single">
        <div class="dsbn-inname">ในนามลูกค้า</div>
        <div class="dsbn-line"></div>
        <div class="dsbn-labels"><span>ผู้รับวางบิล</span></div>
        <div class="dsbn-daterow">
          <div class="dsbn-subrow"><span>วันที่รับวางบิล</span><span class="dsbn-subline"></span></div>
          <div class="dsbn-subrow"><span>วันที่ชำระเงิน</span><span class="dsbn-subline"></span></div>
        </div>
      </div>`;
  } else if (isQuote) {
    const sigImgOrLine = (record.showSignature && issuerSigner?.signatureImage)
      ? `<div class="quote-sig-imgwrap"><img src="${esc(issuerSigner.signatureImage)}" alt="ลายเซ็น" class="quote-sig-img" /></div>`
      : `<div class="quote-sig-line"></div>`;
    signHtml = `
      <div class="quote-sign-grid">
        <div class="quote-sig-col">
          <div class="quote-sig-inname">ในนามบริษัท ${esc(company.nameEn)}</div>
          ${sigImgOrLine}
          <div class="quote-sig-name">( ${esc(record.signerIssuer || "—")} )</div>
          <div class="quote-sig-role">ผู้เสนอราคา</div>
          <div class="quote-sig-date">วันที่ ${esc(formatShortThaiDate(record.date))}</div>
        </div>
        <div class="quote-sig-col">
          <div class="quote-sig-inname">ในนามลูกค้า (ผู้อนุมัติสั่งซื้อ)</div>
          <div class="quote-sig-line"></div>
          <div class="quote-sig-name quote-sig-blank"><span>(</span><span class="quote-sig-blank-space"></span><span>)</span></div>
          <div class="quote-sig-role">ผู้อนุมัติสั่งซื้อ</div>
          <div class="quote-sig-date">วันที่ ......../......../..........</div>
        </div>
      </div>`;
  } else {
    const paymentChecks = PAYMENT_METHODS.map((m) => {
      const checked = record.paymentMethod === m;
      const chequeExtra = m === "เช็คธนาคาร"
        ? `<span class="dsg-line dsg-line-sm">${esc(record.chequeNo)}</span><span>เลขที่</span>` : "";
      return `<div class="dsg-check"><span class="dsg-box ${checked ? "dsg-box-checked" : ""}">${checked ? "✓" : ""}</span><span>${esc(m)}</span>${chequeExtra}</div>`;
    }).join("");
    const receiptParen = isReceipt ? `<div class="dsg-paren">( ${esc(record.signerIssuer || "—")} )</div>` : "";
    signHtml = `
      <div class="doc-sign-grid">
        <div class="dsg-col">
          <div class="dsg-note">ได้รับสินค้าในสภาพเรียบร้อย ครบถ้วน</div>
          <div class="dsg-note">พร้อมได้รับใบกำกับภาษีเรียบร้อยแล้ว</div>
          <div class="dsg-field"><span>ผู้รับของ</span><span class="dsg-line"></span><span>วันที่</span><span class="dsg-line dsg-line-sm"></span></div>
          <div class="dsg-field"><span>ผู้ส่งของ</span><span class="dsg-line"></span></div>
          <div class="dsg-paren">( ${esc(record.signerIssuer || "—")} )</div>
        </div>
        <div class="dsg-col">
          <div class="dsg-field"><span>ผู้รับเงิน</span><span class="dsg-line"></span><span>ตัวบรรจง</span></div>
          ${receiptParen}
          <div class="dsg-field"><span>วันที่</span><span class="dsg-line"></span></div>
          ${paymentChecks}
          <div class="dsg-field"><span>ลงวันที่</span><span class="dsg-line"></span></div>
        </div>
        <div class="dsg-col dsg-col-sign">
          <div class="dsg-sig"><span class="dsg-sig-line"></span><span class="dsg-paren">( ${esc(record.signerIssuer || "—")} )</span><span class="dsg-role">ผู้จัดทำ</span></div>
          <div class="dsg-sig"><span class="dsg-sig-line"></span><span class="dsg-paren">( ${esc(record.signerApprover || "—")} )</span><span class="dsg-role">ผู้อนุมัติ</span></div>
        </div>
      </div>`;
  }

  const projectRow = (isQuote && project) ? `
    <div class="dp-row dp-row-block"><span class="dp-k">โครงการ</span><span class="dp-v">${esc(project.name)}</span></div>` : "";

  const dpRightExtra = (!isBilling && !isQuote) ? `
    <div class="dp-row2"><span class="dp-k">เงื่อนไขการชำระเงิน</span><span class="dp-v mono-amt">${record.creditDays || 0} วัน</span></div>
    <div class="dp-row2"><span class="dp-k">วันครบกำหนดชำระ</span><span class="dp-v mono-amt">${esc(formatShortThaiDate(record.dueDate) || "—")}</span></div>` : "";

  const dpRightBottom = isBilling ? `
    <div class="dp-sig-inline">
      <span class="dp-k">ผู้วางบิล</span><span class="dp-sig-line-inline"></span>
      <span class="dp-sig-name">( ${esc(record.signerIssuer || "—")} )</span>
    </div>` : `
    <div class="dp-row2"><span class="dp-k">ผู้ติดต่อ</span><span class="dp-v">${esc(customer?.contactName || "")}</span></div>
    <div class="dp-row2"><span class="dp-k">พนักงานขาย</span><span class="dp-v">${esc(record.signerSales || "—")}</span></div>`;

  return `
<div class="sheet">
  <div class="doc-ribbon">${esc(ribbonLabel)}</div>
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
  <div class="doc-name-wrap"><div class="doc-name">${esc(printType)} (${esc(FIN_TYPE_EN[printType] || "")})</div></div>
  <div class="doc-party">
    <div class="dp-left">
      <div class="dp-row">
        <span class="dp-k">รหัสลูกค้า</span><span class="dp-v mono-amt">${esc(customer?.code || "—")}</span>
        <span class="dp-k dp-k2">เลขประจำตัวผู้เสียภาษี</span><span class="dp-v mono-amt">${esc(customer?.taxId || "—")}</span>
      </div>
      <div class="dp-row dp-row-block"><span class="dp-k">ชื่อ</span><span class="dp-v dp-strong">${esc(custName)}${esc(custBranch)}</span></div>
      <div class="dp-row dp-row-block"><span class="dp-k">ที่อยู่</span><span class="dp-v">${esc(customer?.address || project?.address || "")}</span></div>
      ${projectRow}
      <div class="dp-row">
        <span class="dp-k">เบอร์โทร</span><span class="dp-v">${esc(customer?.phone || "—")}</span>
        <span class="dp-k dp-k2">แฟกซ์</span><span class="dp-v">${esc(customer?.fax || "—")}</span>
      </div>
      <div class="dp-row"><span class="dp-k">E-mail</span><span class="dp-v">${esc(customer?.email || "—")}</span></div>
    </div>
    <div class="dp-right">
      <div class="dp-row2"><span class="dp-k">วันที่</span><span class="dp-v mono-amt">${esc(formatShortThaiDate(record.date))}</span></div>
      <div class="dp-row2"><span class="dp-k">เลขที่บิล</span><span class="dp-v mono-amt">${esc(docCode)}</span></div>
      ${dpRightExtra}
      ${dpRightBottom}
    </div>
  </div>
  ${tableHtml}
  ${paymentTermsHtml}
  ${footerHtml}
  ${signHtml}
</div>`;
}

export default function PrintDoc({ payload, data, onClose }) {
  const openedRef = useRef(false);

  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;

    const { record, printType } = payload;
    const docCode = record.kind === "salesSet"
      ? buildDocCode(printType, record.period, record.running)
      : record.code;

    const sheetHtml = buildDocPageHtml({ record, printType, copyType: "ต้นฉบับ (ORIGINAL)", data });

    const html = `<!doctype html>
<html lang="th"><head><meta charset="utf-8" />
<title>${esc(docCode)}</title>
<style>${PRINT_CSS}</style>
</head><body>
<div class="pv-bar no-print">
  <span class="pv-label">พรีวิวก่อนพิมพ์ — ${esc(printType)}</span>
  <select id="copyTypeSelect">
    <option value="ต้นฉบับ">ต้นฉบับ (ORIGINAL)</option>
    <option value="สำเนา">สำเนา (COPY)</option>
  </select>
  <button onclick="window.print()">🖶 พิมพ์ / บันทึก PDF</button>
</div>
<div class="sheet-wrap">
${sheetHtml}
</div>
<script>
  document.getElementById('copyTypeSelect').addEventListener('change', function (e) {
    var ribbon = document.querySelector('.doc-ribbon');
    if (ribbon) ribbon.textContent = e.target.value;
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
  }, [payload, data, onClose]);

  return null;
}

/* ---------------------------------------------------------
   PrintDocSet — พิมพ์รวมทั้งชุดเอกสารเป็น PDF เดียว
--------------------------------------------------------- */
const SET_DOC_TYPES = ["ใบวางบิล", "ใบแจ้งหนี้", "ใบกำกับภาษี", "ใบเสร็จรับเงิน"];

export function PrintDocSet({ payload, data, onClose }) {
  const openedRef = useRef(false);

  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;

    const { record, counts } = payload;
    const docCode = buildDocCode("ใบวางบิล", record.period, record.running);

    // เรียงตามลำดับประเภทเอกสาร แต่ละประเภทพิมพ์ต้นฉบับก่อนแล้วตามด้วยสำเนา ตามจำนวนที่กำหนด
    const pages = [];
    SET_DOC_TYPES.forEach((t) => {
      const c = (counts && counts[t]) || { original: 1, copy: 0 };
      for (let i = 0; i < (c.original || 0); i++) pages.push({ printType: t, copyType: "ต้นฉบับ (ORIGINAL)" });
      for (let i = 0; i < (c.copy || 0); i++) pages.push({ printType: t, copyType: "สำเนา (COPY)" });
    });

    const sheetsHtml = pages.map((p) => buildDocPageHtml({ record, printType: p.printType, copyType: p.copyType, data })).join("\n");

    const html = `<!doctype html>
<html lang="th"><head><meta charset="utf-8" />
<title>ชุดเอกสาร-${esc(docCode)}</title>
<style>${PRINT_CSS}</style>
</head><body>
<div class="pv-bar no-print">
  <span class="pv-label">พรีวิวก่อนพิมพ์ — ชุดเอกสาร (${pages.length} แผ่น)</span>
  <button onclick="window.print()">🖶 พิมพ์รวม / บันทึก PDF เดียว</button>
</div>
<div class="sheet-wrap">
${sheetsHtml}
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
  }, [payload, data, onClose]);

  return null;
}
