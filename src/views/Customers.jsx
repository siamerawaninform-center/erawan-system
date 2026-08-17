import { useState } from "react";
import { TitleBlock, Modal, EmptyState, Toolbar, FormDivider } from "../components/UI.jsx";
import { uid } from "../lib/format.js";
import { nextCustomerCode } from "../lib/docNumber.js";

/* ---------------------------------------------------------
   ทะเบียนลูกค้า
   ฟิลด์อ้างอิงจากหัวเอกสารจริง (ใบวางบิล/ใบแจ้งหนี้/ใบกำกับภาษี)
   เก็บครั้งเดียว เลือกใช้ซ้ำได้ทุกเอกสาร ไม่ต้องพิมพ์ซ้ำ
--------------------------------------------------------- */

export default function Customers({ data, upsert, remove }) {
  const [modal, setModal] = useState(null);
  const [q, setQ] = useState("");

  const list = (data.customers || []).filter((c) =>
    `${c.code} ${c.nameTh} ${c.taxId} ${c.branch}`.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="view">
      <TitleBlock
        eyebrow="07 — ทะเบียนข้อมูลกลาง"
        title="ลูกค้า"
        sheetNo={`${list.length}/${(data.customers || []).length}`}
        note="บันทึกข้อมูลลูกค้าครั้งเดียว แล้วเลือกใช้ซ้ำได้ทุกเอกสาร — ข้อมูลจะเติมลงหัวเอกสารอัตโนมัติ"
      />

      <Toolbar>
        <input
          className="search"
          placeholder="ค้นหารหัสลูกค้า ชื่อ หรือเลขผู้เสียภาษี…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn btn-primary" onClick={() => setModal({ mode: "add" })}>
          + เพิ่มลูกค้า
        </button>
      </Toolbar>

      {(data.customers || []).length === 0 ? (
        <EmptyState
          title="ยังไม่มีทะเบียนลูกค้า"
          body="เพิ่มลูกค้าที่ทำงานด้วยเป็นประจำ เพื่อไม่ต้องพิมพ์ชื่อ ที่อยู่ และเลขผู้เสียภาษีซ้ำทุกครั้งที่ออกเอกสาร"
          actionLabel="+ เพิ่มลูกค้ารายแรก"
          onAction={() => setModal({ mode: "add" })}
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>รหัส</th>
                <th>ชื่อลูกค้า</th>
                <th>สาขา</th>
                <th>เลขผู้เสียภาษี</th>
                <th>ผู้ติดต่อ</th>
                <th>เบอร์โทร</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td className="mono-code">{c.code}</td>
                  <td>{c.nameTh}</td>
                  <td>{c.branch || "—"}</td>
                  <td className="mono-amt">{c.taxId || "—"}</td>
                  <td>{c.contactName || "—"}</td>
                  <td>{c.phone || "—"}</td>
                  <td className="row-actions">
                    <button className="icon-btn" onClick={() => setModal({ mode: "edit", item: c })} aria-label="แก้ไข">✎</button>
                    <button
                      className="icon-btn"
                      onClick={() => { if (confirm(`ลบลูกค้า "${c.nameTh}"?`)) remove("customers", c.id, "ลูกค้า"); }}
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
        <CustomerForm
          mode={modal.mode}
          item={modal.item}
          existing={data.customers || []}
          onSave={(item) => { upsert("customers", item, "ลูกค้า"); setModal(null); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function CustomerForm({ mode, item, existing, onSave, onClose }) {
  const [f, setF] = useState(
    item || {
      id: uid("cus"),
      code: nextCustomerCode(existing),
      nameTh: "",
      branch: "",
      taxId: "",
      address: "",
      phone: "",
      fax: "",
      email: "",
      contactName: "",
      creditDays: 30,
      note: "",
    }
  );
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <Modal title={mode === "add" ? "เพิ่มลูกค้า" : "แก้ไขข้อมูลลูกค้า"} onClose={onClose} wide>
      <form
        className="form"
        onSubmit={(e) => { e.preventDefault(); if (!f.nameTh.trim()) return; onSave(f); }}
      >
        <div className="form-grid-3">
          <div className="form-row">
            <label>รหัสลูกค้า</label>
            <input value={f.code} onChange={set("code")} className="mono-input" />
          </div>
          <div className="form-row form-span-2">
            <label>ชื่อลูกค้า (นิติบุคคล) *</label>
            <input
              value={f.nameTh}
              onChange={set("nameTh")}
              placeholder="เช่น บริษัท เอบี ฟู้ด แอนด์ เบฟเวอร์เรจส์ (ประเทศไทย) จำกัด"
              required
              autoFocus
            />
          </div>
        </div>

        <div className="form-grid-3">
          <div className="form-row">
            <label>สาขา</label>
            <input value={f.branch} onChange={set("branch")} placeholder="เช่น 00001 หรือ สำนักงานใหญ่" />
          </div>
          <div className="form-row">
            <label>เลขประจำตัวผู้เสียภาษี</label>
            <input value={f.taxId} onChange={set("taxId")} placeholder="เลข 13 หลัก" className="mono-input" />
          </div>
          <div className="form-row">
            <label>เครดิต (วัน)</label>
            <input
              type="number"
              min="0"
              value={f.creditDays}
              onChange={set("creditDays")}
              placeholder="30"
            />
          </div>
        </div>

        <div className="form-row">
          <label>ที่อยู่ (สำหรับออกเอกสาร)</label>
          <textarea
            rows={2}
            value={f.address}
            onChange={set("address")}
            placeholder="เลขที่ ซอย ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"
          />
        </div>

        <FormDivider>ข้อมูลติดต่อ</FormDivider>
        <div className="form-grid-3">
          <div className="form-row">
            <label>ผู้ติดต่อ</label>
            <input value={f.contactName} onChange={set("contactName")} placeholder="ชื่อผู้ประสานงาน" />
          </div>
          <div className="form-row">
            <label>เบอร์โทร</label>
            <input value={f.phone} onChange={set("phone")} />
          </div>
          <div className="form-row">
            <label>แฟกซ์</label>
            <input value={f.fax} onChange={set("fax")} />
          </div>
        </div>
        <div className="form-row">
          <label>อีเมล</label>
          <input value={f.email} onChange={set("email")} />
        </div>
        <div className="form-row">
          <label>หมายเหตุ</label>
          <textarea rows={2} value={f.note} onChange={set("note")} placeholder="เงื่อนไขพิเศษ ข้อควรระวัง ฯลฯ" />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="btn btn-primary">บันทึกลูกค้า</button>
        </div>
      </form>
    </Modal>
  );
}
