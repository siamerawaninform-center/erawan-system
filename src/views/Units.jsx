import { useState } from "react";
import { TitleBlock, Modal, EmptyState, Toolbar, FormDivider } from "../components/UI.jsx";
import { uid } from "../lib/format.js";

/* ---------------------------------------------------------
   10 ทะเบียนหน่วยนับ — จัดการรายการหน่วยเอง แล้วเอาไปเป็นตัวช่วยพิมพ์
   (datalist) ในช่องหน่วยของ BOQ และใบเสนอราคา/เอกสารบัญชี
--------------------------------------------------------- */

export default function Units({ data, upsert, remove }) {
  const [modal, setModal] = useState(null);
  const list = data.units || [];

  return (
    <div className="view">
      <TitleBlock
        eyebrow="10 — ทะเบียนข้อมูลกลาง"
        title="หน่วยนับ"
        sheetNo={`${list.length} หน่วย`}
        note="รายการในทะเบียนนี้จะขึ้นเป็นตัวช่วยพิมพ์ในช่องหน่วยของ BOQ และใบเสนอราคา/เอกสารบัญชี — พิมพ์บางส่วนแล้วเลือกได้เลย"
      />

      <Toolbar>
        <span className="muted">
          {list.length === 0 ? "ยังไม่มีหน่วยนับ" : `มีหน่วยนับ ${list.length} รายการ`}
        </span>
        <button className="btn btn-primary" onClick={() => setModal({ mode: "add" })}>
          + เพิ่มหน่วยนับ
        </button>
      </Toolbar>

      {list.length === 0 ? (
        <EmptyState
          title="ยังไม่มีทะเบียนหน่วยนับ"
          body="เพิ่มหน่วยที่ใช้บ่อย เช่น งาน, ชุด, เมตร, ตร.ม., กก. เพื่อให้เลือกใช้ตอนกรอก BOQ/ใบเสนอราคาได้ทันที"
          actionLabel="+ เพิ่มหน่วยนับแรก"
          onAction={() => setModal({ mode: "add" })}
        />
      ) : (
        <div className="chip-row-scroll" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {list.map((u) => (
            <div key={u.id} className="unit-chip">
              <span>{u.name}</span>
              <button className="icon-btn" onClick={() => setModal({ mode: "edit", item: u })} aria-label="แก้ไข">✎</button>
              <button
                className="icon-btn"
                onClick={() => { if (confirm(`ลบหน่วย "${u.name}"?`)) remove("units", u.id, "หน่วยนับ"); }}
                aria-label="ลบ"
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <UnitForm
          mode={modal.mode}
          item={modal.item}
          onSave={(item) => { upsert("units", item, "หน่วยนับ"); setModal(null); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function UnitForm({ mode, item, onSave, onClose }) {
  const [f, setF] = useState(item || { id: uid("unit"), name: "" });

  return (
    <Modal title={mode === "add" ? "เพิ่มหน่วยนับ" : "แก้ไขหน่วยนับ"} onClose={onClose}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); if (!f.name.trim()) return; onSave(f); }}>
        <FormDivider>ชื่อหน่วยนับ</FormDivider>
        <div className="form-row">
          <label>พิมพ์ตามที่อยากให้ขึ้นในตัวช่วยพิมพ์ *</label>
          <input
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            placeholder="เช่น ม., ตร.ม., ชุด, กก., เมตร"
            autoFocus
            required
          />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="btn btn-primary">บันทึกหน่วยนับ</button>
        </div>
      </form>
    </Modal>
  );
}
