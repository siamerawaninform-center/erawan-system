import { useState } from "react";
import { TitleBlock, Modal, EmptyState, Toolbar, FormDivider } from "../components/UI.jsx";
import { Autocomplete } from "../components/Autocomplete.jsx";
import { uid, todayISO, formatShortThaiDate } from "../lib/format.js";
import { nextPlanCode } from "../lib/docNumber.js";
import { PLAN_DAY_STEPS, PLAN_HOUR_STEPS } from "../lib/gantt.js";

/* ---------------------------------------------------------
   แผนงานโครงการ (Gantt) — เลือกหน่วยเวลาได้เอง (วัน/ชั่วโมง)
   และระยะห่างคอลัมน์ได้เอง ไม่ตายตัว
--------------------------------------------------------- */

export default function Plan({ data, upsert, remove, onPrint }) {
  const [modal, setModal] = useState(null);
  const list = data.plans || [];
  const project = (id) => data.projects.find((p) => p.id === id);

  return (
    <div className="view">
      <TitleBlock
        eyebrow="11 — แผนงาน"
        title="แผนงานโครงการ (Timeline)"
        sheetNo={`${list.length} ฉบับ`}
        note="กำหนดช่วงเวลาทำงานของแต่ละรายการ พิมพ์เป็นตาราง Gantt ขนาด A4 แนวนอน"
      />

      <Toolbar>
        <span className="muted">{list.length === 0 ? "ยังไม่มีแผนงาน" : `มีแผนงาน ${list.length} ฉบับ`}</span>
        <button
          className="btn btn-primary"
          onClick={() => setModal({ mode: "add" })}
          disabled={data.projects.length === 0}
        >+ สร้างแผนงาน</button>
      </Toolbar>

      {data.projects.length === 0 ? (
        <EmptyState title="ยังไม่มีโปรเจกต์ให้ทำแผนงาน" body="เพิ่มโปรเจกต์อย่างน้อย 1 รายการก่อน" />
      ) : list.length === 0 ? (
        <EmptyState
          title="ยังไม่มีแผนงานในระบบ"
          body="สร้างแผนงานเพื่อกำหนดลำดับขั้นตอนการทำงานและระยะเวลาของแต่ละรายการ"
          actionLabel="+ สร้างแผนงานแรก"
          onAction={() => setModal({ mode: "add" })}
        />
      ) : (
        <div className="card-grid">
          {list.map((p) => {
            const proj = project(p.projectId);
            return (
              <div className="card" key={p.id}>
                <div className="card-top"><span className="mono-code">{p.code}</span></div>
                <h4>{proj?.name || "—"}</h4>
                <p className="card-sub">ผู้จัดการโปรเจกต์: {p.managerName || "—"}</p>
                <p className="card-line">
                  {(p.tasks || []).length} รายการงาน ·{" "}
                  {p.unit === "hour"
                    ? `${formatShortThaiDate(p.hourDate)} (${p.startHour}:00-${p.endHour}:00)`
                    : `${formatShortThaiDate(p.startDate)} — ${formatShortThaiDate(p.endDate)}`}
                </p>
                <div className="card-actions">
                  <button className="btn btn-ghost" onClick={() => setModal({ mode: "edit", item: p })}>แก้ไข</button>
                  <button className="btn btn-ghost" onClick={() => onPrint(p)}>🖶 พิมพ์</button>
                  <button
                    className="btn btn-danger"
                    onClick={() => { if (confirm(`ลบแผนงาน "${p.code}"?`)) remove("plans", p.id, "แผนงาน"); }}
                  >ลบ</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <PlanForm
          mode={modal.mode}
          item={modal.item}
          data={data}
          onSave={(item) => { upsert("plans", item, "แผนงาน"); setModal(null); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function PlanForm({ mode, item, data, onSave, onClose }) {
  const [f, setF] = useState(() => {
    if (item) return item;
    const proj = data.projects[0];
    const today = todayISO();
    const in14 = new Date(); in14.setDate(in14.getDate() + 14);
    return {
      id: uid("pln"),
      projectId: proj?.id || "",
      projectCode: proj?.code || "",
      code: nextPlanCode(data.plans, proj?.code || ""),
      title: "แผนงานโครงการ",
      managerName: "",
      date: today,
      unit: "day",
      startDate: today,
      endDate: in14.toISOString().slice(0, 10),
      stepDays: 2,
      hourDate: today,
      startHour: 8,
      endHour: 17,
      stepHours: 1,
      tasks: [{ id: uid("tsk"), no: 1, description: "", start: today, end: today }],
      preparerId: data.signers.find((s) => s.isDefault)?.id || "",
      showSignature: false,
      note: "",
    };
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const changeProject = (projectId) => {
    const proj = data.projects.find((p) => p.id === projectId);
    setF({
      ...f,
      projectId,
      projectCode: proj?.code || "",
      code: mode === "add" ? nextPlanCode(data.plans, proj?.code || "") : f.code,
      managerName: f.managerName || proj?.managerName || "",
    });
  };

  const setTask = (id, key, value) =>
    setF({ ...f, tasks: f.tasks.map((t) => (t.id === id ? { ...t, [key]: value } : t)) });
  const addTask = () =>
    setF({ ...f, tasks: [...f.tasks, { id: uid("tsk"), no: f.tasks.length + 1, description: "", start: f.startDate || f.hourDate, end: f.endDate || f.hourDate }] });
  const removeTask = (id) =>
    setF({ ...f, tasks: f.tasks.filter((t) => t.id !== id).map((t, i) => ({ ...t, no: i + 1 })) });

  const isHour = f.unit === "hour";
  const signer = data.signers.find((s) => s.id === f.preparerId);
  const hourOptions = Array.from({ length: 24 }, (_, h) => h);

  return (
    <Modal title={mode === "add" ? "สร้างแผนงาน" : "แก้ไขแผนงาน"} onClose={onClose} xwide>
      <form className="form" onSubmit={(e) => { e.preventDefault(); if (!f.projectId) return; onSave(f); }}>
        <div className="form-grid-3">
          <div className="form-row">
            <label>โปรเจกต์ * (พิมพ์เพื่อค้นหา)</label>
            <Autocomplete
              options={data.projects.map((p) => ({ id: p.id, label: p.name, sublabel: p.code }))}
              value={f.projectId}
              onChange={changeProject}
              allowClear={false}
            />
          </div>
          <div className="form-row">
            <label>รหัสแผนงาน</label>
            <input value={f.code} onChange={set("code")} className="mono-input" />
          </div>
          <div className="form-row">
            <label>วันที่จัดทำ</label>
            <input type="date" value={f.date} onChange={set("date")} />
          </div>
        </div>

        <div className="form-grid-2">
          <div className="form-row">
            <label>ชื่อแผนงาน</label>
            <input value={f.title} onChange={set("title")} />
          </div>
          <div className="form-row">
            <label>ผู้จัดการโปรเจกต์</label>
            <input value={f.managerName} onChange={set("managerName")} placeholder="ชื่อผู้ควบคุมงาน/ผู้จัดการโปรเจกต์" />
          </div>
        </div>

        <FormDivider>ช่วงเวลาของแผนงาน</FormDivider>
        <div className="form-row">
          <div className="unit-toggle">
            <label className="check-item">
              <input type="radio" name="unit" checked={!isHour} onChange={() => setF({ ...f, unit: "day" })} />
              รายวัน
            </label>
            <label className="check-item">
              <input type="radio" name="unit" checked={isHour} onChange={() => setF({ ...f, unit: "hour" })} />
              รายชั่วโมง (ภายในวันเดียว)
            </label>
          </div>
        </div>

        {!isHour ? (
          <div className="form-grid-3">
            <div className="form-row">
              <label>วันที่เริ่ม</label>
              <input type="date" value={f.startDate} onChange={set("startDate")} />
            </div>
            <div className="form-row">
              <label>วันที่สิ้นสุด</label>
              <input type="date" value={f.endDate} onChange={set("endDate")} />
            </div>
            <div className="form-row">
              <label>ระยะห่างคอลัมน์</label>
              <select value={f.stepDays} onChange={set("stepDays")}>
                {PLAN_DAY_STEPS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div className="form-grid-3">
            <div className="form-row">
              <label>วันที่ทำงาน</label>
              <input type="date" value={f.hourDate} onChange={set("hourDate")} />
            </div>
            <div className="form-row">
              <label>เวลาเริ่ม — สิ้นสุด</label>
              <div className="hour-range">
                <select value={f.startHour} onChange={(e) => setF({ ...f, startHour: Number(e.target.value) })}>
                  {hourOptions.map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
                </select>
                <span>—</span>
                <select value={f.endHour} onChange={(e) => setF({ ...f, endHour: Number(e.target.value) })}>
                  {hourOptions.map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <label>ระยะห่างคอลัมน์</label>
              <select value={f.stepHours} onChange={set("stepHours")}>
                {PLAN_HOUR_STEPS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
        )}

        <FormDivider>รายการงาน</FormDivider>
        <div className="plan-tasks">
          <div className="plan-task-row plan-task-head">
            <span>ลำดับ</span><span>รายละเอียดงาน</span><span>เริ่ม</span><span>สิ้นสุด</span><span></span>
          </div>
          {f.tasks.map((t) => (
            <div className="plan-task-row" key={t.id}>
              <span className="mono-amt">{t.no}</span>
              <input value={t.description} onChange={(e) => setTask(t.id, "description", e.target.value)} placeholder="เช่น งานปรับปรุงพื้นโกดัง" />
              {!isHour ? (
                <input type="date" value={t.start} onChange={(e) => setTask(t.id, "start", e.target.value)} />
              ) : (
                <select value={t.start} onChange={(e) => setTask(t.id, "start", Number(e.target.value))}>
                  {hourOptions.map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
                </select>
              )}
              {!isHour ? (
                <input type="date" value={t.end} onChange={(e) => setTask(t.id, "end", e.target.value)} />
              ) : (
                <select value={t.end} onChange={(e) => setTask(t.id, "end", Number(e.target.value))}>
                  {hourOptions.map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
                </select>
              )}
              <button type="button" className="icon-btn" onClick={() => removeTask(t.id)} aria-label="ลบ">✕</button>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={addTask}>+ เพิ่มรายการงาน</button>

        <FormDivider>ผู้จัดทำแผนงาน</FormDivider>
        <div className="form-grid-2">
          <div className="form-row">
            <label>ผู้จัดทำ</label>
            <select value={f.preparerId} onChange={set("preparerId")}>
              <option value="">— ไม่ระบุ —</option>
              {data.signers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label className="check-item">
              <input
                type="checkbox"
                checked={f.showSignature}
                onChange={(e) => setF({ ...f, showSignature: e.target.checked })}
                disabled={!signer?.signatureImage}
              />
              แสดงรูปลายเซ็นจริงตอนพิมพ์ (ถ้าไม่ติ๊ก จะเว้นเส้นว่างให้เซ็นด้วยปากกา)
              {!signer?.signatureImage && <span className="field-hint"> (ยังไม่มีรูปลายเซ็นในทะเบียน)</span>}
            </label>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="btn btn-primary">บันทึกแผนงาน</button>
        </div>
      </form>
    </Modal>
  );
}
