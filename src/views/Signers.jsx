import { useState } from "react";
import { TitleBlock, Modal, EmptyState, Toolbar } from "../components/UI.jsx";
import { uid } from "../lib/format.js";

/* ---------------------------------------------------------
   ทะเบียนผู้ลงนาม
   ตั้งชื่อไว้ที่นี่ครั้งเดียว แล้วเลือกจาก dropdown ตอนออกเอกสาร
   ชื่อจะไปปรากฏในทุกช่องลงนามของเอกสารนั้นอัตโนมัติ
--------------------------------------------------------- */

export default function Signers({ data, upsert, remove }) {
  const [modal, setModal] = useState(null);
  const list = data.signers || [];

  return (
    <div className="view">
      <TitleBlock
        eyebrow="07 — ทะเบียนข้อมูลกลาง"
        title="ผู้ลงนาม"
        sheetNo={`${list.length} คน`}
        note="ชื่อในทะเบียนนี้จะขึ้นเป็นตัวเลือกในช่อง ผู้วางบิล / ผู้จัดทำ / ผู้อนุมัติ / พนักงานขาย ตอนออกเอกสาร"
      />

      <Toolbar>
        <span className="muted">
          {list.length === 0 ? "ยังไม่มีผู้ลงนาม" : `มีผู้ลงนาม ${list.length} คน`}
        </span>
        <button className="btn btn-primary" onClick={() => setModal({ mode: "add" })}>
          + เพิ่มผู้ลงนาม
        </button>
      </Toolbar>

      {list.length === 0 ? (
        <EmptyState
          title="ยังไม่มีทะเบียนผู้ลงนาม"
          body="เพิ่มชื่อผู้มีอำนาจลงนาม เช่น ผู้จัดทำเอกสาร ผู้อนุมัติ พนักงานขาย เพื่อเลือกใช้ตอนออกเอกสารได้ทันที"
          actionLabel="+ เพิ่มผู้ลงนามคนแรก"
          onAction={() => setModal({ mode: "add" })}
        />
      ) : (
        <div className="card-grid">
          {list.map((s) => (
            <div className="card" key={s.id}>
              <div className="card-top">
                <span className="mono-code">{s.isDefault ? "ค่าเริ่มต้น" : "ผู้ลงนาม"}</span>
              </div>
              <h4>{s.name}</h4>
              <p className="card-sub">{s.position || "ยังไม่ระบุตำแหน่ง"}</p>
              {s.signatureImage && (
                <div className="sig-preview">
                  <img src={s.signatureImage} alt={`ลายเซ็น ${s.name}`} />
                </div>
              )}
              {s.roles?.length > 0 && (
                <div className="tag-row">
                  {s.roles.map((r) => <span className="tag" key={r}>{r}</span>)}
                </div>
              )}
              <div className="card-actions">
                <button className="btn btn-ghost" onClick={() => setModal({ mode: "edit", item: s })}>แก้ไข</button>
                <button
                  className="btn btn-danger"
                  onClick={() => { if (confirm(`ลบผู้ลงนาม "${s.name}"?`)) remove("signers", s.id, "ผู้ลงนาม"); }}
                >ลบ</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <SignerForm
          mode={modal.mode}
          item={modal.item}
          allSigners={list}
          onSave={(item, clearOtherDefaults) => {
            if (clearOtherDefaults) {
              // ให้มีค่าเริ่มต้นได้คนเดียว
              list.filter((s) => s.isDefault && s.id !== item.id)
                  .forEach((s) => upsert("signers", { ...s, isDefault: false }));
            }
            upsert("signers", item, "ผู้ลงนาม");
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

const SIGNER_ROLES = ["ผู้วางบิล", "ผู้จัดทำ", "ผู้อนุมัติ", "พนักงานขาย", "ผู้รับเงิน", "ผู้ส่งของ", "ผู้ควบคุมงาน", "ผู้ประมาณการ"];

function SignerForm({ mode, item, onSave, onClose }) {
  const [f, setF] = useState(
    item || { id: uid("sgn"), name: "", position: "", roles: [], isDefault: false, signatureImage: "" }
  );
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const toggleRole = (r) => {
    const has = (f.roles || []).includes(r);
    setF({ ...f, roles: has ? f.roles.filter((x) => x !== r) : [...(f.roles || []), r] });
  };

  const onUploadSignature = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // ย่อขนาดไม่ให้ไฟล์ใหญ่เกินไป (กว้างสุด 480px)
        const maxW = 480;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // ลบพื้นหลังสีขาว/สว่างออกให้โปร่งใส เหลือแต่เส้นลายเซ็น
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;
        const WHITE_THRESHOLD = 235;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          if (r > WHITE_THRESHOLD && g > WHITE_THRESHOLD && b > WHITE_THRESHOLD) {
            d[i + 3] = 0; // โปร่งใสสนิท
          }
        }
        ctx.putImageData(imgData, 0, 0);

        setF((prev) => ({ ...prev, signatureImage: canvas.toDataURL("image/png") }));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <Modal title={mode === "add" ? "เพิ่มผู้ลงนาม" : "แก้ไขผู้ลงนาม"} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => { e.preventDefault(); if (!f.name.trim()) return; onSave(f, f.isDefault); }}
      >
        <div className="form-row">
          <label>ชื่อ-นามสกุล *</label>
          <input value={f.name} onChange={set("name")} placeholder="เช่น สุมาลี บุญรักษา" required autoFocus />
        </div>
        <div className="form-row">
          <label>ตำแหน่ง</label>
          <input value={f.position} onChange={set("position")} placeholder="เช่น ผู้จัดการฝ่ายบัญชี" />
        </div>
        <div className="form-row">
          <label>รูปลายเซ็น (ไม่บังคับ — ใช้เมื่อเลือก "แสดงลายเซ็น" ตอนพิมพ์เอกสาร)</label>
          {f.signatureImage && (
            <div className="sig-preview sig-preview-lg">
              <img src={f.signatureImage} alt="ตัวอย่างลายเซ็น" />
            </div>
          )}
          <div className="sig-upload-row">
            <label className="btn btn-ghost btn-sm sig-upload-btn">
              {f.signatureImage ? "เปลี่ยนรูปลายเซ็น" : "+ อัปโหลดรูปลายเซ็น"}
              <input type="file" accept="image/*" onChange={onUploadSignature} hidden />
            </label>
            {f.signatureImage && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setF({ ...f, signatureImage: "" })}>
                ลบรูปลายเซ็น
              </button>
            )}
          </div>
          <p className="field-hint">แนะนำ: ถ่ายรูปลายเซ็นบนกระดาษขาวให้ชัด แสงสม่ำเสมอ ไม่มีเงา</p>
        </div>
        <div className="form-row">
          <label>ลงนามในฐานะ (เลือกได้หลายข้อ)</label>
          <div className="check-grid check-grid-2">
            {SIGNER_ROLES.map((r) => (
              <label className="check-item" key={r}>
                <input
                  type="checkbox"
                  checked={(f.roles || []).includes(r)}
                  onChange={() => toggleRole(r)}
                />
                {r}
              </label>
            ))}
          </div>
        </div>
        <div className="form-row">
          <label className="check-item">
            <input
              type="checkbox"
              checked={!!f.isDefault}
              onChange={(e) => setF({ ...f, isDefault: e.target.checked })}
            />
            ตั้งเป็นผู้ลงนามเริ่มต้น (เอกสารใหม่จะเลือกชื่อนี้ให้ทันที)
          </label>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="btn btn-primary">บันทึกผู้ลงนาม</button>
        </div>
      </form>
    </Modal>
  );
}
