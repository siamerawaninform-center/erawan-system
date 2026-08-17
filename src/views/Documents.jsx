import { useState } from "react";
import { TitleBlock, Modal, EmptyState, Toolbar, ChipRow, Stamp } from "../components/UI.jsx";
import { Autocomplete } from "../components/Autocomplete.jsx";
import { uid, todayISO, formatShortThaiDate } from "../lib/format.js";
import { nextAttachCode } from "../lib/docNumber.js";
import { DOC_TYPES } from "../lib/constants.js";

/* ---------------------------------------------------------
   03 เอกสาร — ทะเบียนเอกสารแนบของโปรเจกต์
   เก็บรายการและลิงก์ไฟล์ (ไฟล์จริงเก็บใน Google Drive)
--------------------------------------------------------- */

export default function Documents({ data, upsert, remove }) {
  const [modal, setModal] = useState(null);
  const [filterType, setFilterType] = useState("ทั้งหมด");
  const [q, setQ] = useState("");

  const projectName = (id) => data.projects.find((p) => p.id === id)?.name || "—";

  const list = (data.documents || [])
    .filter((d) => filterType === "ทั้งหมด" || d.docType === filterType)
    .filter((d) => `${d.code} ${d.name}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return (
    <div className="view">
      <TitleBlock
        eyebrow="03 — ทะเบียนเอกสาร"
        title="เอกสารโครงการ"
        sheetNo={`${list.length}/${(data.documents || []).length}`}
        note="บันทึกรายการและลิงก์เอกสาร — ไฟล์จริงแนะนำเก็บใน Google Drive แล้ววางลิงก์ที่นี่"
      />

      <Toolbar>
        <input
          className="search"
          placeholder="ค้นหาชื่อเอกสาร…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          className="btn btn-primary"
          onClick={() => setModal({ mode: "add" })}
          disabled={data.projects.length === 0}
        >+ เพิ่มเอกสาร</button>
      </Toolbar>

      <ChipRow options={DOC_TYPES} value={filterType} onChange={setFilterType} scroll />

      {data.projects.length === 0 ? (
        <EmptyState title="ยังไม่มีโปรเจกต์ให้ผูกเอกสาร" body="เพิ่มโปรเจกต์อย่างน้อย 1 รายการก่อน" />
      ) : (data.documents || []).length === 0 ? (
        <EmptyState
          title="ยังไม่มีเอกสารในระบบ"
          body="เริ่มบันทึกแบบก่อสร้าง สัญญา ใบอนุญาต หรือรายงานความคืบหน้าของแต่ละโครงการ"
          actionLabel="+ เพิ่มเอกสารแรก"
          onAction={() => setModal({ mode: "add" })}
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>รหัส</th><th>ชื่อเอกสาร</th><th>ประเภท</th>
                <th>โปรเจกต์</th><th>วันที่</th><th>ลิงก์</th><th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id}>
                  <td className="mono-code">{d.code}</td>
                  <td>{d.name}</td>
                  <td><Stamp label={d.docType} variant="steel" /></td>
                  <td>{projectName(d.projectId)}</td>
                  <td>{formatShortThaiDate(d.date)}</td>
                  <td>
                    {d.link
                      ? <a href={d.link} target="_blank" rel="noreferrer" className="link-btn">เปิดลิงก์ ↗</a>
                      : "—"}
                  </td>
                  <td className="row-actions">
                    <button className="icon-btn" onClick={() => setModal({ mode: "edit", item: d })} aria-label="แก้ไข">✎</button>
                    <button
                      className="icon-btn"
                      onClick={() => { if (confirm(`ลบเอกสาร "${d.name}"?`)) remove("documents", d.id, "เอกสาร"); }}
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
        <DocumentForm
          mode={modal.mode}
          item={modal.item}
          data={data}
          onSave={(item) => { upsert("documents", item, "เอกสาร"); setModal(null); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function DocumentForm({ mode, item, data, onSave, onClose }) {
  const [f, setF] = useState(
    item || {
      id: uid("doc"),
      code: nextAttachCode(data.documents),
      name: "",
      docType: DOC_TYPES[0],
      projectId: data.projects[0]?.id || "",
      date: todayISO(),
      link: "",
      note: "",
    }
  );
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <Modal title={mode === "add" ? "เพิ่มเอกสาร" : "แก้ไขเอกสาร"} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => { e.preventDefault(); if (!f.name.trim() || !f.projectId) return; onSave(f); }}
      >
        <div className="form-row">
          <label>รหัสเอกสาร</label>
          <input value={f.code} onChange={set("code")} className="mono-input" />
        </div>
        <div className="form-row">
          <label>ชื่อเอกสาร *</label>
          <input value={f.name} onChange={set("name")} placeholder="เช่น แบบโครงสร้าง ชั้น 1-4 (Rev.2)" required autoFocus />
        </div>
        <div className="form-grid-2">
          <div className="form-row">
            <label>ประเภทเอกสาร</label>
            <select value={f.docType} onChange={set("docType")}>
              {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>โปรเจกต์ * (พิมพ์เพื่อค้นหา)</label>
            <Autocomplete
              options={data.projects.map((p) => ({ id: p.id, label: p.name, sublabel: p.code }))}
              value={f.projectId}
              onChange={(id) => setF({ ...f, projectId: id })}
              placeholder="พิมพ์ชื่อโปรเจกต์…"
              allowClear={false}
            />
          </div>
        </div>
        <div className="form-grid-2">
          <div className="form-row">
            <label>วันที่เอกสาร</label>
            <input type="date" value={f.date} onChange={set("date")} />
          </div>
          <div className="form-row">
            <label>ลิงก์ไฟล์ (Google Drive ฯลฯ)</label>
            <input value={f.link} onChange={set("link")} placeholder="https://drive.google.com/…" />
          </div>
        </div>
        <div className="form-row">
          <label>หมายเหตุ</label>
          <textarea rows={2} value={f.note} onChange={set("note")} />
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="btn btn-primary">บันทึกเอกสาร</button>
        </div>
      </form>
    </Modal>
  );
}
