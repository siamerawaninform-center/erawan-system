import { useEffect } from "react";
import { Logo } from "./UI.jsx";
import { formatShortThaiDate } from "../lib/format.js";
import { COMPANY_DEFAULT } from "../lib/constants.js";

/* ---------------------------------------------------------
   พิมพ์ JSA — ตามเทมเพลตจริงของบริษัท
   ตารางยาวได้หลายหน้าตามธรรมชาติ (ไม่บังคับ 1 หน้า เหมือนเอกสารอื่น)
--------------------------------------------------------- */

export default function PrintJSA({ jsa, data, onClose }) {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 250);
    function onAfterPrint() { onClose(); }
    window.addEventListener("afterprint", onAfterPrint);
    return () => { clearTimeout(t); window.removeEventListener("afterprint", onAfterPrint); };
  }, [onClose]);

  // ตั้งชื่อไฟล์ตอนพิมพ์/บันทึก PDF ให้ตรงกับรหัส JSA อัตโนมัติ
  useEffect(() => {
    const prevTitle = document.title;
    document.title = jsa.code;
    return () => { document.title = prevTitle; };
  }, [jsa.code]);

  const company = { ...COMPANY_DEFAULT, ...(data.company || {}) };
  const signer = data.signers.find((s) => s.id === jsa.approverId);

  return (
    <div className="print-overlay">
      <div className="print-toolbar no-print">
        <span className="pt-label">พรีวิวก่อนพิมพ์ — JSA</span>
        <div className="pt-right">
          <button className="btn btn-ghost" onClick={onClose}>✕ ปิด</button>
          <button className="btn btn-primary" onClick={() => window.print()}>🖶 พิมพ์ / บันทึก PDF</button>
        </div>
      </div>

      <div className="print-area a4 jsa-print">
        <div className="doc-top">
          <div className="doc-company">
            <Logo size={54} />
            <div className="doc-company-text">
              <div className="dc-name">{company.nameTh}</div>
              <div className="dc-line">{company.address}</div>
              <div className="dc-line">โทรศัพท์. {company.phone} , E-mail : {company.email}</div>
              <div className="dc-line">เลขประจำตัวผู้เสียภาษี : {company.taxId}</div>
            </div>
          </div>
        </div>
        <div className="doc-top-rule" />

        <div className="jsa-meta">
          <div><b>ชื่องาน (Job Title)</b> {jsa.jobTitle}</div>
          <div><b>วันที่ (Date)</b> {formatShortThaiDate(jsa.date)}</div>
          <div><b>สถานที่ (Location)</b> {jsa.location || "—"}</div>
          <div><b>ผู้ควบคุมงาน (Supervisor)</b> {jsa.supervisorName || "—"}</div>
        </div>

        <div className="doc-name-wrap">
          <div className="doc-name">ตารางวิเคราะห์ความปลอดภัยในการทำงาน (JSA Table)</div>
        </div>

        <table className="doc-table jsa-table">
          <thead>
            <tr>
              <th style={{ width: "6%" }}>ลำดับ</th>
              <th style={{ width: "22%" }}>ขั้นตอนการทำงาน<br />(Task Sequence)</th>
              <th style={{ width: "26%" }}>อันตรายที่อาจเกิดขึ้น<br />(Potential Hazards)</th>
              <th style={{ width: "32%" }}>มาตรการป้องกันและควบคุม<br />(Control Measures)</th>
              <th style={{ width: "14%" }}>ผู้ตรวจสอบ<br />(Check)</th>
            </tr>
          </thead>
          <tbody>
            {(jsa.rows || []).map((r, i) => (
              <tr key={r.id}>
                <td className="doc-center">{i + 1}</td>
                <td className="doc-desc jsa-cell">{r.step}</td>
                <td className="doc-desc jsa-cell">{r.hazards}</td>
                <td className="doc-desc jsa-cell">{r.controls}</td>
                <td className="doc-center jsa-cell">{r.inspector}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="jsa-sign">
          <div className="plan-sig">
            {jsa.showSignature && signer?.signatureImage ? (
              <img src={signer.signatureImage} alt="ลายเซ็น" className="dsg-sig-img" />
            ) : (
              <span className="dsg-sig-line" />
            )}
            <span className="dsg-paren">( {signer?.name || "—"} )</span>
            <span className="dsg-role">ผู้อนุมัติ/ควบคุมงาน</span>
          </div>
        </div>
      </div>
    </div>
  );
}
