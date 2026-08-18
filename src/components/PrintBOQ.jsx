import { useEffect, useState, useLayoutEffect, useRef } from "react";
import { Logo } from "./UI.jsx";
import { baht, bahtText, formatShortThaiDate, num, computeBoqTotals } from "../lib/format.js";
import { COMPANY_DEFAULT } from "../lib/constants.js";

/* ---------------------------------------------------------
   พิมพ์ BOQ — รายการประมาณราคา (BILL OF QUANTITY)
   ตามเทมเพลตจริงของบริษัท
--------------------------------------------------------- */

export default function PrintBOQ({ boq, data, onClose }) {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 250);
    function onAfterPrint() { onClose(); }
    window.addEventListener("afterprint", onAfterPrint);
    return () => { clearTimeout(t); window.removeEventListener("afterprint", onAfterPrint); };
  }, [onClose]);

  // ตั้งชื่อไฟล์ตอนพิมพ์/บันทึก PDF ให้ตรงกับรหัส BOQ อัตโนมัติ
  useEffect(() => {
    const prevTitle = document.title;
    document.title = boq.code;
    return () => { document.title = prevTitle; };
  }, [boq.code]);

  const company = { ...COMPANY_DEFAULT, ...(data.company || {}) };
  const project = data.projects.find((p) => p.id === boq.projectId);
  const signer = data.signers.find((s) => s.id === boq.estimatorId);
  const totals = computeBoqTotals(boq.items, boq.markupPercent, boq.vat, boq.discount);

  // ย่อขนาดเนื้อหาอัตโนมัติให้พอดี 1 หน้า A4 เสมอ
  const pageRef = useRef(null);
  const contentRef = useRef(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const page = pageRef.current;
    const content = contentRef.current;
    if (!page || !content) return;

    const recalc = () => {
      content.style.zoom = 1;
      const cs = getComputedStyle(page);
      const padTop = parseFloat(cs.paddingTop) || 0;
      const padBottom = parseFloat(cs.paddingBottom) || 0;
      const availableHeight = page.clientHeight - padTop - padBottom;
      const naturalHeight = content.scrollHeight;
      if (naturalHeight > availableHeight && naturalHeight > 0) {
        setScale((availableHeight / naturalHeight) * 0.96);
      } else {
        setScale(1);
      }
    };

    recalc();
    window.addEventListener("beforeprint", recalc);
    return () => window.removeEventListener("beforeprint", recalc);
  }, [boq, data]);

  return (
    <div className="print-overlay">
      <div className="print-toolbar no-print">
        <span className="pt-label">พรีวิวก่อนพิมพ์ — BOQ</span>
        <div className="pt-right">
          <button className="btn btn-ghost" onClick={onClose}>✕ ปิด</button>
          <button className="btn btn-primary" onClick={() => window.print()}>🖶 พิมพ์ / บันทึก PDF</button>
        </div>
      </div>

      <div className="print-area a4" ref={pageRef}>
        <div
          ref={contentRef}
          className="doc-page-inner"
          style={{ zoom: scale }}
        >
        <div className="doc-top">
          <div className="doc-company">
            <Logo size={58} />
            <div className="doc-company-text">
              <div className="dc-name">{company.nameTh}</div>
              <div className="dc-line">{company.address}</div>
              <div className="dc-line">โทรศัพท์. {company.phone}</div>
              <div className="dc-line">
                E-mail : {company.email}
                <span className="dc-taxid">เลขประจำตัวผู้เสียภาษี {company.taxId}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="doc-top-rule" />

        <div className="doc-name-wrap">
          <div className="doc-name">รายการประมาณราคา (BILL OF QUANTITY)</div>
        </div>

        <div className="boq-info">
          <div><b>โครงการ</b> : {project?.name || "—"}</div>
          <div><b>สถานที่ก่อสร้าง</b> : {project?.address || "—"}</div>
          <div><b>เลขที่</b> : <span className="mono-amt">{boq.code}</span> &nbsp;&nbsp; <b>วันที่</b> : {formatShortThaiDate(boq.date)}</div>
        </div>

        <table className="doc-table boq-print-table">
          <thead>
            <tr>
              <th rowSpan={2}>ลำดับ</th>
              <th rowSpan={2}>รายการ</th>
              <th rowSpan={2}>ปริมาณ</th>
              <th rowSpan={2}>หน่วย</th>
              <th colSpan={2}>ค่าวัสดุ</th>
              <th colSpan={2}>ค่าแรงงาน</th>
              <th rowSpan={2}>รวมเป็นเงิน (บาท)</th>
            </tr>
            <tr>
              <th>หน่วยละ</th><th>รวม</th><th>หน่วยละ</th><th>รวม</th>
            </tr>
          </thead>
          <tbody>
            {(boq.items || []).map((it, idx) => {
              const matTotal = (Number(it.qty) || 0) * (Number(it.materialUnitPrice) || 0);
              const laborTotalLine = (Number(it.qty) || 0) * (Number(it.laborUnitPrice) || 0);
              return (
                <tr key={it.id}>
                  <td className="doc-center">{idx + 1}</td>
                  <td className="doc-desc">{it.description}</td>
                  <td className="doc-center">{num(it.qty)}</td>
                  <td className="doc-center">{it.unit}</td>
                  <td className="doc-num">{baht(it.materialUnitPrice)}</td>
                  <td className="doc-num">{baht(matTotal)}</td>
                  <td className="doc-num">{baht(it.laborUnitPrice)}</td>
                  <td className="doc-num">{baht(laborTotalLine)}</td>
                  <td className="doc-num">{baht(matTotal + laborTotalLine)}</td>
                </tr>
              );
            })}
            <tr className="boq-subtotal-row">
              <td colSpan={4} className="doc-foot-label">รวมค่าก่อสร้าง (ค่าวัสดุ+ค่าแรง)</td>
              <td className="doc-num">{baht(totals.materialTotal)}</td>
              <td></td>
              <td className="doc-num">{baht(totals.laborTotal)}</td>
              <td></td>
              <td className="doc-num">{baht(totals.constructionTotal)}</td>
            </tr>
            <tr>
              <td colSpan={8} className="doc-foot-label">ค่าดำเนินการและกำไร ({boq.markupPercent || 0}%)</td>
              <td className="doc-num">{baht(totals.markupAmount)}</td>
            </tr>
            <tr>
              <td colSpan={8} className="doc-foot-label">รวมค่าก่อสร้าง+กำไร</td>
              <td className="doc-num">{baht(totals.afterMarkup)}</td>
            </tr>
            {boq.vat && (
              <tr>
                <td colSpan={8} className="doc-foot-label">ภาษีมูลค่าเพิ่ม 7%</td>
                <td className="doc-num">{baht(totals.vatAmount)}</td>
              </tr>
            )}
            {Number(boq.discount) > 0 && (
              <tr>
                <td colSpan={8} className="doc-foot-label">ส่วนลด</td>
                <td className="doc-num">{baht(boq.discount)}</td>
              </tr>
            )}
            <tr className="boq-grand-row">
              <td colSpan={8} className="doc-foot-label">รวมเป็นเงินทั้งสิ้น</td>
              <td className="doc-num doc-foot-total">{baht(totals.total)}</td>
            </tr>
            <tr>
              <td colSpan={9} className="boq-bahttext">*** {bahtText(totals.total)} ***</td>
            </tr>
          </tbody>
        </table>

        {boq.note && <div className="boq-note"><b>หมายเหตุ:</b> {boq.note}</div>}

        <div className="doc-sign-grid boq-sign">
          <div className="dsg-col dsg-col-sign" style={{ marginLeft: "auto" }}>
            <div className="dsg-sig">
              {boq.showSignature && signer?.signatureImage ? (
                <img src={signer.signatureImage} alt="ลายเซ็น" className="dsg-sig-img" />
              ) : (
                <span className="dsg-sig-line" />
              )}
              <span className="dsg-paren">( {signer?.name || "—"} )</span>
              <span className="dsg-role">ผู้ประมาณการ</span>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
