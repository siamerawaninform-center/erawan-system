import { useState } from "react";
import { TitleBlock, Modal, EmptyState, Toolbar, FormDivider } from "../components/UI.jsx";
import { uid } from "../lib/format.js";
import { nextSupplierCode } from "../lib/docNumber.js";
import { EXPENSE_CATEGORIES } from "../lib/constants.js";

/* ---------------------------------------------------------
   ทะเบียนซัพพลายเออร์ / ผู้รับเหมาช่วง
   ใช้ตอนบันทึกรายจ่าย ภาษีซื้อ และหัก ณ ที่จ่าย
--------------------------------------------------------- */

export default function Suppliers({ data, upsert, remove }) {
  const [modal, setModal] = useState(null);
  const [q, setQ] = useState("");

  const list = (data.suppliers || []).filter((s) =>
    `${s.code} ${s.nameTh} ${s.taxId}`.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="view">
      <TitleBlock
        eyebrow="07 — ทะเบียนข้อมูลกลาง"
        title="ซัพพลายเออร์"
        sheetNo={`${list.length}/${(data.suppliers || []).length}`}
        note="ผู้ขายวัสดุ ผู้รับเหมาช่วง ผู้ให้เช่าเครื่องจักร — ใช้ตอนบันทึกภาษีซื้อและหัก ณ ที่จ่าย"
      />

      <Toolbar>
        <input
          className="search"
          placeholder="ค้นหารหัส ชื่อ หรือเลขผู้เสียภาษี…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn btn-primary" onClick={() => setModal({ mode: "add" })}>
          + เพิ่มซัพพลายเออร์
        </button>
      </Toolbar>

      {(data.suppliers || []).length === 0 ? (
        <EmptyState
          title="ยังไม่มีทะเบียนซัพพลายเออร์"
          body="เพิ่มผู้ขายและผู้รับเหมาช่วงที่ใช้บริการเป็นประจำ เพื่อบันทึกภาษีซื้อได้เร็วขึ้น"
          actionLabel="+ เพิ่มซัพพลายเออร์รายแรก"
          onAction={() => setModal({ mode: "add" })}
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>รหัส</th>
                <th>ชื่อ</th>
                <th>ประเภทงาน</th>
                <th>เลขผู้เสียภาษี</th>
                <th>เบอร์โทร</th>
                <th>หัก ณ ที่จ่าย</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td className="mono-code">{s.code}</td>
                  <td>{s.nameTh}</td>
                  <td>{s.category || "—"}</td>
                  <td className="mono-amt">{s.taxId || "—"}</td>
                  <td>{s.phone || "—"}</td>
                  <td className="mono-amt">{s.defaultWht ? `${s.defaultWht}%` : "—"}</td>
                  <td className="row-actions">
                    <button className="icon-btn" onClick={() => setModal({ mode: "edit", item: s })} aria-label="แก้ไข">✎</button>
                    <button
                      className="icon-btn"
                      onClick={() => { if (confirm(`ลบ "${s.nameTh}"?`)) remove("suppliers", s.id, "ซัพพลายเออร์"); }}
                      aria-label="ลบ"
                    >🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <SupplierForm
          mode={modal.mode}
          item={modal.item}
          existing={data.suppliers || []}
          onSave={(item) => { upsert("suppliers", item, "ซัพพลายเออร์"); setModal(null); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function SupplierForm({ mode, item, existing, onSave, onClose }) {
  const [f, setF] = useState(
    item || {
      id: uid("sup"),
      code: nextSupplierCode(existing),
      nameTh: "",
      branch: "",
      taxId: "",
      address: "",
      phone: "",
      email: "",
      contactName: "",
      category: EXPENSE_CATEGORIES[0],
      defaultWht: "",
      bankInfo: "",
      note: "",
    }
  );
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <Modal title={mode === "add" ? "เพิ่มซัพพลายเออร์" : "แก้ไขข้อมูลซัพพลายเออร์"} onClose={onClose} wide>
      <form
        className="form"
        onSubmit={(e) => { e.preventDefault(); if (!f.nameTh.trim()) return; onSave(f); }}
      >
        <div className="form-grid-3">
          <div className="form-row">
            <label>รหัส</label>
            <input value={f.code} onChange={set("code")} className="mono-input" />
          </div>
          <div className="form-row form-span-2">
            <label>ชื่อผู้ขาย / ผู้รับเหมา *</label>
            <input value={f.nameTh} onChange={set("nameTh")} required autoFocus />
          </div>
        </div>

        <div className="form-grid-3">
          <div className="form-row">
            <label>ประเภทงานที่ซื้อบ่อย</label>
            <select value={f.category} onChange={set("category")}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>เลขประจำตัวผู้เสียภาษี</label>
            <input value={f.taxId} onChange={set("taxId")} className="mono-input" placeholder="เลข 13 หลัก" />
          </div>
          <div className="form-row">
            <label>สาขา</label>
            <input value={f.branch} onChange={set("branch")} placeholder="สำนักงานใหญ่" />
          </div>
        </div>

        <div className="form-row">
          <label>ที่อยู่</label>
          <textarea rows={2} value={f.address} onChange={set("address")} />
        </div>

        <FormDivider>ข้อมูลติดต่อ และการหักภาษี</FormDivider>
        <div className="form-grid-3">
          <div className="form-row">
            <label>ผู้ติดต่อ</label>
            <input value={f.contactName} onChange={set("contactName")} />
          </div>
          <div className="form-row">
            <label>เบอร์โทร</label>
            <input value={f.phone} onChange={set("phone")} />
          </div>
          <div className="form-row">
            <label>อัตราหัก ณ ที่จ่ายที่ใช้บ่อย (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={f.defaultWht}
              onChange={set("defaultWht")}
              placeholder="เช่น 3"
            />
          </div>
        </div>
        <div className="form-row">
          <label>บัญชีธนาคารสำหรับโอนจ่าย</label>
          <input value={f.bankInfo} onChange={set("bankInfo")} placeholder="ธนาคาร / ชื่อบัญชี / เลขบัญชี" />
        </div>
        <div className="form-row">
          <label>หมายเหตุ</label>
          <textarea rows={2} value={f.note} onChange={set("note")} />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="btn btn-primary">บันทึกซัพพลายเออร์</button>
        </div>
      </form>
    </Modal>
  );
}
