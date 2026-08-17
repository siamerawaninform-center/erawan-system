import { useState } from "react";
import { TitleBlock, Modal, EmptyState, Toolbar, Stamp, FormDivider, projectStatusVariant } from "../components/UI.jsx";
import { Autocomplete } from "../components/Autocomplete.jsx";
import { uid, baht, todayISO, formatShortThaiDate } from "../lib/format.js";
import { nextProjectCode } from "../lib/docNumber.js";
import { PROJECT_STATUSES } from "../lib/constants.js";

/* ---------------------------------------------------------
   02 โปรเจกต์ — ข้อมูลเบื้องต้นของโครงการ
   + งวดเบิกเงิน (ดึงไปเติมข้อความในเอกสารเรียกเก็บอัตโนมัติ)
   จัดกลุ่มแบบ "โฟลเดอร์" ตามสถานะ ให้หาโปรเจกต์ที่กำลังทำอยู่ได้ง่าย
--------------------------------------------------------- */

// เรียงลำดับกลุ่มตามความสำคัญในการใช้งานประจำวัน (งานที่ทำอยู่ขึ้นก่อน)
const GROUP_ORDER = ["กำลังดำเนินการ", "เสนอราคา", "รอเริ่มงาน", "เสร็จสิ้น", "ระงับ"];

export default function Projects({ data, upsert, removeProject }) {
  const [modal, setModal] = useState(null);
  const [q, setQ] = useState("");
  // ย่อกลุ่ม "เสร็จสิ้น" กับ "ระงับ" ไว้ก่อน เพราะไม่ใช่งานที่ต้องดูประจำวัน
  const [collapsed, setCollapsed] = useState({ "เสร็จสิ้น": true, "ระงับ": true });

  const customerName = (id) => data.customers.find((c) => c.id === id)?.nameTh || "";

  const list = data.projects.filter((p) =>
    `${p.name} ${p.code} ${customerName(p.customerId)} ${p.clientName || ""}`
      .toLowerCase().includes(q.toLowerCase())
  );

  const groups = GROUP_ORDER.map((status) => ({
    status,
    items: list.filter((p) => p.status === status),
  })).filter((g) => g.items.length > 0);

  const toggleGroup = (status) => setCollapsed({ ...collapsed, [status]: !collapsed[status] });

  return (
    <div className="view">
      <TitleBlock
        eyebrow="02 — ทะเบียนโครงการ"
        title="โปรเจกต์"
        sheetNo={`${list.length}/${data.projects.length}`}
      />

      <Toolbar>
        <input
          className="search"
          placeholder="ค้นหาโปรเจกต์ ลูกค้า หรือรหัส…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn btn-primary" onClick={() => setModal({ mode: "add" })}>
          + เพิ่มโปรเจกต์
        </button>
      </Toolbar>

      {data.projects.length === 0 ? (
        <EmptyState
          title="ยังไม่มีโปรเจกต์ในระบบ"
          body="บันทึกโครงการแรกเพื่อเริ่มติดตามความคืบหน้า งบประมาณ เอกสาร และงวดเบิกเงิน"
          actionLabel="+ เพิ่มโปรเจกต์แรก"
          onAction={() => setModal({ mode: "add" })}
        />
      ) : list.length === 0 ? (
        <EmptyState title="ไม่พบโปรเจกต์ที่ค้นหา" body="ลองค้นหาด้วยคำอื่น" />
      ) : (
        <div className="project-groups">
          {groups.map((g) => (
            <div className="project-group" key={g.status}>
              <button className="project-group-head" onClick={() => toggleGroup(g.status)}>
                <span className={`pg-arrow ${collapsed[g.status] ? "pg-arrow-closed" : ""}`}>▾</span>
                <Stamp label={g.status} variant={projectStatusVariant(g.status)} />
                <span className="pg-count">{g.items.length} โครงการ</span>
              </button>
              {!collapsed[g.status] && (
                <div className="card-grid">
                  {g.items.map((p) => {
                    const cname = customerName(p.customerId) || p.clientName;
                    const milestones = p.milestones || [];
                    return (
                      <div className="card" key={p.id}>
                        <div className="card-top">
                          <span className="mono-code">{p.code}</span>
                          <Stamp label={p.status} variant={projectStatusVariant(p.status)} />
                        </div>
                        <h4>{p.name}</h4>
                        <p className="card-sub">{cname || "ยังไม่ระบุลูกค้า"}</p>
                        {p.poNumber && <p className="card-line">PO: {p.poNumber}</p>}
                        {p.address && <p className="card-line">📍 {p.address}</p>}
                        <div className="progress-track">
                          <div className="progress-fill" style={{ width: `${p.progress || 0}%` }} />
                        </div>
                        <div className="card-meta-row">
                          <span>ความคืบหน้า {p.progress || 0}%</span>
                          <span>มูลค่างาน ฿{baht(p.budget)}</span>
                        </div>
                        <div className="card-meta-row">
                          <span>เริ่ม {formatShortThaiDate(p.startDate) || "—"}</span>
                          <span>กำหนดเสร็จ {formatShortThaiDate(p.dueDate) || "—"}</span>
                        </div>
                        {milestones.length > 0 && (
                          <div className="milestone-mini">
                            {milestones.map((m, i) => (
                              <span key={i} className={`ms-chip ${m.billed ? "ms-done" : ""}`}>
                                งวด {m.no} · {m.percent}%
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="card-actions">
                          <button className="btn btn-ghost" onClick={() => setModal({ mode: "edit", item: p })}>แก้ไข</button>
                          <button
                            className="btn btn-danger"
                            onClick={() => {
                              if (confirm(`ลบโปรเจกต์ "${p.name}"?\n\nเอกสาร BOQ แผนงาน JSA รายจ่าย และเอกสารบัญชีที่ผูกกับโปรเจกต์นี้จะถูกลบทั้งหมด`))
                                removeProject(p.id);
                            }}
                          >ลบ</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <ProjectForm
          mode={modal.mode}
          item={modal.item}
          data={data}
          onSave={(item) => { upsert("projects", item, "โปรเจกต์"); setModal(null); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function ProjectForm({ mode, item, data, onSave, onClose }) {
  const [f, setF] = useState(
    item || {
      id: uid("prj"),
      code: nextProjectCode(data.projects),
      name: "",
      customerId: "",
      clientName: "",
      address: "",
      poNumber: "",
      poDate: "",
      status: PROJECT_STATUSES[0],
      progress: 0,
      budget: "",
      startDate: todayISO(),
      dueDate: "",
      milestones: [],
      notes: "",
    }
  );
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const addMilestone = () =>
    setF({
      ...f,
      milestones: [
        ...(f.milestones || []),
        { no: (f.milestones?.length || 0) + 1, percent: "", condition: "", billed: false },
      ],
    });
  const setMilestone = (idx, key, value) =>
    setF({
      ...f,
      milestones: f.milestones.map((m, i) => (i === idx ? { ...m, [key]: value } : m)),
    });
  const removeMilestone = (idx) =>
    setF({
      ...f,
      milestones: f.milestones.filter((_, i) => i !== idx).map((m, i) => ({ ...m, no: i + 1 })),
    });

  const msTotal = (f.milestones || []).reduce((s, m) => s + (Number(m.percent) || 0), 0);

  return (
    <Modal title={mode === "add" ? "เพิ่มโปรเจกต์" : "แก้ไขโปรเจกต์"} onClose={onClose} wide>
      <form
        className="form"
        onSubmit={(e) => { e.preventDefault(); if (!f.name.trim()) return; onSave(f); }}
      >
        <div className="form-grid-3">
          <div className="form-row">
            <label>รหัสโปรเจกต์</label>
            <input value={f.code} onChange={set("code")} className="mono-input" />
          </div>
          <div className="form-row form-span-2">
            <label>ชื่อโปรเจกต์ *</label>
            <input
              value={f.name}
              onChange={set("name")}
              placeholder="เช่น งานปรับพื้นที่ดินและปลูกหญ้าบริเวณหน้าโรงงาน"
              required
              autoFocus
            />
          </div>
        </div>

        <div className="form-grid-2">
          <div className="form-row">
            <label>ลูกค้า (จากทะเบียนลูกค้า — พิมพ์เพื่อค้นหา)</label>
            <Autocomplete
              options={data.customers.map((c) => ({ id: c.id, label: c.nameTh, sublabel: c.code }))}
              value={f.customerId}
              onChange={(id) => setF({ ...f, customerId: id })}
              placeholder="พิมพ์ชื่อลูกค้า…"
            />
          </div>
          <div className="form-row">
            <label>หรือพิมพ์ชื่อลูกค้าเอง</label>
            <input
              value={f.clientName}
              onChange={set("clientName")}
              placeholder="ใช้เมื่อยังไม่ได้เพิ่มในทะเบียน"
              disabled={!!f.customerId}
            />
          </div>
        </div>

        <div className="form-row">
          <label>ที่ตั้งโครงการ / หน้างาน</label>
          <input value={f.address} onChange={set("address")} placeholder="ที่อยู่ หรือรหัสพื้นที่ เช่น RC-BE, CL-BE FP.3" />
        </div>

        <div className="form-grid-3">
          <div className="form-row">
            <label>เลขที่ใบสั่งซื้อ (PO)</label>
            <input value={f.poNumber} onChange={set("poNumber")} className="mono-input" placeholder="เช่น 4000011198" />
          </div>
          <div className="form-row">
            <label>วันที่ PO</label>
            <input type="date" value={f.poDate} onChange={set("poDate")} />
          </div>
          <div className="form-row">
            <label>มูลค่างานตามสัญญา (บาท)</label>
            <input type="number" min="0" step="0.01" value={f.budget} onChange={set("budget")} placeholder="0.00" />
          </div>
        </div>

        <div className="form-grid-3">
          <div className="form-row">
            <label>สถานะ</label>
            <select value={f.status} onChange={set("status")}>
              {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>วันที่เริ่มงาน</label>
            <input type="date" value={f.startDate} onChange={set("startDate")} />
          </div>
          <div className="form-row">
            <label>กำหนดเสร็จ</label>
            <input type="date" value={f.dueDate} onChange={set("dueDate")} />
          </div>
        </div>

        <div className="form-row">
          <label>ความคืบหน้า: {f.progress || 0}%</label>
          <input type="range" min="0" max="100" value={f.progress || 0} onChange={set("progress")} />
        </div>

        <FormDivider>
          งวดเบิกเงิน — ระบบจะดึงไปเติมข้อความในเอกสารเรียกเก็บอัตโนมัติ
          {msTotal > 0 && (
            <span className={msTotal === 100 ? "ms-ok" : "ms-warn"}>
              {" "}(รวม {msTotal}%{msTotal !== 100 ? " — ยังไม่ครบ 100%" : ""})
            </span>
          )}
        </FormDivider>

        {(f.milestones || []).length > 0 && (
          <div className="ms-table">
            <div className="ms-row ms-row-head">
              <span>งวด</span><span>%</span><span>เงื่อนไขการเบิก</span><span>วางบิลแล้ว</span><span></span>
            </div>
            {f.milestones.map((m, i) => (
              <div className="ms-row" key={i}>
                <span className="mono-amt">{m.no}</span>
                <input
                  type="number" min="0" max="100"
                  value={m.percent}
                  onChange={(e) => setMilestone(i, "percent", e.target.value)}
                />
                <input
                  value={m.condition}
                  onChange={(e) => setMilestone(i, "condition", e.target.value)}
                  placeholder="เช่น เมื่อได้รับใบสั่งซื้อ / เมื่องานแล้วเสร็จ 50%"
                />
                <label className="check-item ms-check">
                  <input
                    type="checkbox"
                    checked={!!m.billed}
                    onChange={(e) => setMilestone(i, "billed", e.target.checked)}
                  />
                </label>
                <button type="button" className="icon-btn" onClick={() => removeMilestone(i)} aria-label="ลบงวด">✕</button>
              </div>
            ))}
          </div>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={addMilestone}>+ เพิ่มงวดเบิก</button>

        <div className="form-row">
          <label>หมายเหตุ</label>
          <textarea rows={2} value={f.notes} onChange={set("notes")} placeholder="รายละเอียดเพิ่มเติมของโครงการ" />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="btn btn-primary">บันทึกโปรเจกต์</button>
        </div>
      </form>
    </Modal>
  );
}
