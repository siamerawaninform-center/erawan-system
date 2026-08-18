import { useState } from "react";
import { TitleBlock, Modal, EmptyState, Toolbar } from "../components/UI.jsx";
import { uid } from "../lib/format.js";

/* ---------------------------------------------------------
   ทีมงาน — รายชื่อพนักงานและการมอบหมายโปรเจกต์
--------------------------------------------------------- */

export default function Team({ data, upsert, remove }) {
  const [modal, setModal] = useState(null);
  const list = data.team || [];

  return (
    <div className="view">
      <TitleBlock eyebrow="05 — บุคลากร" title="ทีมงาน" sheetNo={`${list.length} คน`} />

      <Toolbar>
        <span className="muted">พนักงานทั้งหมด {list.length} คน</span>
        <button className="btn btn-primary" onClick={() => setModal({ mode: "add" })}>+ เพิ่มพนักงาน</button>
      </Toolbar>

      {list.length === 0 ? (
        <EmptyState
          title="ยังไม่มีรายชื่อพนักงาน"
          body="เพิ่มพนักงานเพื่อมอบหมายให้ดูแลโครงการต่างๆ"
          actionLabel="+ เพิ่มพนักงานคนแรก"
          onAction={() => setModal({ mode: "add" })}
        />
      ) : (
        <div className="card-grid">
          {list.map((t) => (
            <div className="card" key={t.id}>
              <div className="card-top">
                <span className="mono-code">{(t.role || "STAFF").slice(0, 10)}</span>
              </div>
              <h4>{t.name}</h4>
              <p className="card-sub">{t.role || "ยังไม่ระบุตำแหน่ง"}</p>
              {t.phone && <p className="card-line">☎ {t.phone}</p>}
              <div className="tag-row">
                {(t.projectIds || []).length === 0
                  ? <span className="muted">ยังไม่มอบหมายโปรเจกต์</span>
                  : data.projects
                      .filter((p) => (t.projectIds || []).includes(p.id))
                      .map((p) => <span className="tag" key={p.id}>{p.code}</span>)}
              </div>
              <div className="card-actions">
                <button className="btn btn-ghost" onClick={() => setModal({ mode: "edit", item: t })}>แก้ไข</button>
                <button
                  className="btn btn-danger"
                  onClick={() => { if (confirm(`ลบพนักงาน "${t.name}"?`)) remove("team", t.id, "พนักงาน"); }}
                >ลบ</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <TeamForm
          mode={modal.mode}
          item={modal.item}
          projects={data.projects}
          onSave={(item) => { upsert("team", item, "พนักงาน"); setModal(null); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function TeamForm({ mode, item, projects, onSave, onClose }) {
  const [f, setF] = useState(
    item || { id: uid("stf"), name: "", role: "", phone: "", projectIds: [] }
  );
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggleProject = (id) => {
    const has = (f.projectIds || []).includes(id);
    setF({ ...f, projectIds: has ? f.projectIds.filter((x) => x !== id) : [...(f.projectIds || []), id] });
  };

  return (
    <Modal title={mode === "add" ? "เพิ่มพนักงาน" : "แก้ไขพนักงาน"} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => { e.preventDefault(); if (!f.name.trim()) return; onSave(f); }}
      >
        <div className="form-row">
          <label>ชื่อ-นามสกุล *</label>
          <input value={f.name} onChange={set("name")} required autoFocus />
        </div>
        <div className="form-grid-2">
          <div className="form-row">
            <label>ตำแหน่ง</label>
            <input value={f.role} onChange={set("role")} placeholder="เช่น วิศวกรโครงการ, โฟร์แมน, จป." />
          </div>
          <div className="form-row">
            <label>เบอร์โทร</label>
            <input value={f.phone} onChange={set("phone")} />
          </div>
        </div>
        <div className="form-row">
          <label>มอบหมายโปรเจกต์</label>
          {projects.length === 0 ? (
            <p className="muted">ยังไม่มีโปรเจกต์ในระบบ</p>
          ) : (
            <div className="check-grid">
              {projects.map((p) => (
                <label className="check-item" key={p.id}>
                  <input
                    type="checkbox"
                    checked={(f.projectIds || []).includes(p.id)}
                    onChange={() => toggleProject(p.id)}
                  />
                  {p.code} — {p.name}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="btn btn-primary">บันทึกพนักงาน</button>
        </div>
      </form>
    </Modal>
  );
}
