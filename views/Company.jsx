import { useState } from "react";
import { TitleBlock, FormDivider, Logo } from "../components/UI.jsx";
import { COMPANY_DEFAULT } from "../lib/constants.js";

/* ---------------------------------------------------------
   ตั้งค่าบริษัท — ข้อมูลที่ไปแสดงบนหัวเอกสารทุกใบ
   ค่าเริ่มต้นดึงจากเอกสารจริงของบริษัทมาให้แล้ว
--------------------------------------------------------- */

export default function Company({ company, onSave }) {
  const [f, setF] = useState({
    ...COMPANY_DEFAULT,
    ...(company || {}),
    startingRunning: { ...COMPANY_DEFAULT.startingRunning, ...(company?.startingRunning || {}) },
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setRun = (k) => (e) =>
    setF({ ...f, startingRunning: { ...f.startingRunning, [k]: e.target.value } });

  return (
    <div className="view">
      <TitleBlock
        eyebrow="06 — ข้อมูลนิติบุคคล"
        title="ตั้งค่าบริษัท"
        sheetNo="1/1"
        note="ข้อมูลนี้จะแสดงบนหัวเอกสารทุกใบที่พิมพ์ออกมา"
      />

      <div className="company-preview">
        <Logo size={64} />
        <div>
          <div className="cp-name">{f.nameTh || "—"}</div>
          <div className="cp-meta">{f.address}</div>
          <div className="cp-meta">โทรศัพท์ {f.phone} · E-mail : {f.email}</div>
          <div className="cp-meta">เลขประจำตัวผู้เสียภาษี {f.taxId}</div>
        </div>
      </div>

      <form className="form form-panel" onSubmit={(e) => { e.preventDefault(); onSave(f); }}>
        <div className="form-row">
          <label>ชื่อบริษัท (ไทย) — ตามที่ต้องการให้ขึ้นหัวเอกสาร</label>
          <input value={f.nameTh} onChange={set("nameTh")} />
        </div>
        <div className="form-row">
          <label>ชื่อบริษัท (อังกฤษ)</label>
          <input value={f.nameEn} onChange={set("nameEn")} />
        </div>
        <div className="form-row">
          <label>ที่อยู่</label>
          <textarea rows={2} value={f.address} onChange={set("address")} />
        </div>
        <div className="form-grid-3">
          <div className="form-row">
            <label>เลขประจำตัวผู้เสียภาษี</label>
            <input value={f.taxId} onChange={set("taxId")} className="mono-input" />
          </div>
          <div className="form-row">
            <label>โทรศัพท์</label>
            <input value={f.phone} onChange={set("phone")} />
          </div>
          <div className="form-row">
            <label>อีเมล</label>
            <input value={f.email} onChange={set("email")} />
          </div>
        </div>

        <FormDivider>ข้อมูลบัญชีธนาคาร (แสดงในเอกสารเรียกเก็บเงิน ถ้ากรอกไว้)</FormDivider>
        <div className="form-grid-3">
          <div className="form-row">
            <label>ธนาคาร</label>
            <input value={f.bankName} onChange={set("bankName")} placeholder="เช่น ธนาคารกสิกรไทย" />
          </div>
          <div className="form-row">
            <label>ชื่อบัญชี</label>
            <input value={f.bankAccountName} onChange={set("bankAccountName")} />
          </div>
          <div className="form-row">
            <label>เลขที่บัญชี</label>
            <input value={f.bankAccountNo} onChange={set("bankAccountNo")} className="mono-input" />
          </div>
        </div>
        <div className="form-row">
          <label>ข้อความกรณีสั่งจ่ายเช็ค</label>
          <input value={f.chequeNote} onChange={set("chequeNote")} />
        </div>

        <FormDivider>
          เลขวิ่งเริ่มต้น — ตั้งครั้งเดียว ให้เอกสารใหม่รันต่อจากเลขที่ใช้อยู่ในระบบเดิมของบริษัท
          (เช่น ถ้าระบบเดิมล่าสุดถึงเลข 166 ให้ใส่ 167)
        </FormDivider>
        <div className="form-grid-2">
          <div className="form-row">
            <label>เลขวิ่งเริ่มต้น — เอกสารชุดขาย (วางบิล/แจ้งหนี้/กำกับภาษี/เสร็จรับเงิน)</label>
            <input
              type="number" min="1"
              value={f.startingRunning.salesSet}
              onChange={setRun("salesSet")}
              className="mono-input"
            />
          </div>
          <div className="form-row">
            <label>เลขวิ่งเริ่มต้น — ใบเสนอราคา</label>
            <input
              type="number" min="1"
              value={f.startingRunning.quote}
              onChange={setRun("quote")}
              className="mono-input"
            />
          </div>
        </div>
        <p className="muted">
          มีผลเฉพาะตอนสร้างเอกสารใหม่ในเดือนที่ยังไม่เคยออกเอกสารในระบบนี้เลย —
          ถ้าเดือนนั้นมีเอกสารอยู่แล้ว ระบบจะรันต่อจากเอกสารล่าสุดในระบบแทนโดยอัตโนมัติ
        </p>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">บันทึกข้อมูลบริษัท</button>
        </div>
      </form>
    </div>
  );
}
