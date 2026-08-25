import { useState } from "react";
import { TitleBlock, Modal, EmptyState, Toolbar, FormDivider } from "../components/UI.jsx";
import { Autocomplete } from "../components/Autocomplete.jsx";
import { uid, todayISO, formatShortThaiDate } from "../lib/format.js";
import { nextJsaCode } from "../lib/docNumber.js";
import { analyzeSafety } from "../lib/safetyKnowledge.js";

/* ---------------------------------------------------------
   JSA (Job Safety Analysis) — ตารางวิเคราะห์ความปลอดภัยในการทำงาน
   ตามเทมเพลตจริงของบริษัท
--------------------------------------------------------- */

export default function JSA({ data, upsert, remove, onPrint }) {
  const [modal, setModal] = useState(null);
  const list = data.jsas || [];
  const project = (id) => data.projects.find((p) => p.id === id);

  return (
    <div className="view">
      <TitleBlock
        eyebrow="13 — ความปลอดภัย"
        title="JSA (Job Safety Analysis)"
        sheetNo={`${list.length} ฉบับ`}
        note="ตารางวิเคราะห์ความปลอดภัยในการทำงาน — ใช้ส่งให้โรงงานลูกค้าก่อนเริ่มงานบางประเภท"
      />

      <Toolbar>
        <span className="muted">{list.length === 0 ? "ยังไม่มี JSA" : `มี JSA ${list.length} ฉบับ`}</span>
        <button
          className="btn btn-primary"
          onClick={() => setModal({ mode: "add" })}
          disabled={data.projects.length === 0}
        >+ สร้าง JSA</button>
      </Toolbar>

      {data.projects.length === 0 ? (
        <EmptyState title="ยังไม่มีโปรเจกต์ให้ทำ JSA" body="เพิ่มโปรเจกต์อย่างน้อย 1 รายการก่อน" />
      ) : list.length === 0 ? (
        <EmptyState
          title="ยังไม่มี JSA ในระบบ"
          body="สร้าง JSA เพื่อวิเคราะห์อันตรายและมาตรการป้องกันก่อนเริ่มงานที่มีความเสี่ยง"
          actionLabel="+ สร้าง JSA แรก"
          onAction={() => setModal({ mode: "add" })}
        />
      ) : (
        <div className="card-grid">
          {list.map((j) => {
            const proj = project(j.projectId);
            return (
              <div className="card" key={j.id}>
                <div className="card-top"><span className="mono-code">{j.code}</span></div>
                <h4>{j.jobTitle || "—"}</h4>
                <p className="card-sub">{proj?.name || ""}</p>
                <p className="card-line">{j.location || "—"} · {(j.rows || []).length} ขั้นตอน</p>
                <p className="card-line">วันที่ {formatShortThaiDate(j.date)}</p>
                <div className="card-actions">
                  <button className="btn btn-ghost" onClick={() => setModal({ mode: "edit", item: j })}>แก้ไข</button>
                  <button className="btn btn-ghost" onClick={() => onPrint(j)}>🖶 พิมพ์</button>
                  <button
                    className="btn btn-danger"
                    onClick={() => { if (confirm(`ลบ JSA "${j.code}"?`)) remove("jsas", j.id, "JSA"); }}
                  >ลบ</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <JsaForm
          mode={modal.mode}
          item={modal.item}
          data={data}
          onSave={(item) => { upsert("jsas", item, "JSA"); setModal(null); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

const DEFAULT_ROW = () => ({ id: uid("jr"), step: "", hazards: "", controls: "", inspector: "จป. หัวหน้างาน/วิชาชีพ" });

function JsaForm({ mode, item, data, onSave, onClose }) {
  const [f, setF] = useState(() => {
    if (item) return item;
    const proj = data.projects[0];
    return {
      id: uid("jsa"),
      projectId: proj?.id || "",
      projectCode: proj?.code || "",
      code: nextJsaCode(data.jsas, proj?.code || ""),
      jobTitle: "",
      date: todayISO(),
      location: "",
      supervisorName: "นาย สมัคร พืมขุนทด",
      rows: [DEFAULT_ROW()],
      approverId: data.signers.find((s) => s.isDefault)?.id || "",
      showSignature: false,
    };
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const changeProject = (projectId) => {
    const proj = data.projects.find((p) => p.id === projectId);
    setF({
      ...f,
      projectId,
      projectCode: proj?.code || "",
      code: mode === "add" ? nextJsaCode(data.jsas, proj?.code || "") : f.code,
      location: f.location || proj?.address || "",
      jobTitle: f.jobTitle || proj?.name || "",
    });
  };

  const setRow = (id, key, value) =>
    setF({ ...f, rows: f.rows.map((r) => (r.id === id ? { ...r, [key]: value } : r)) });
  const addRow = () => setF({ ...f, rows: [...f.rows, DEFAULT_ROW()] });
  const removeRow = (id) => setF({ ...f, rows: f.rows.filter((r) => r.id !== id) });

  // ดึงขั้นตอนการทำงานจากแผนงาน (Gantt) ของโปรเจกต์นี้ — ใช้ description ของแต่ละ task เป็นขั้นตอนงาน
  const pullStepsFromPlan = () => {
    if (!f.projectId) return;
    const plansOfProject = (data.plans || [])
      .filter((p) => p.projectId === f.projectId)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const plan = plansOfProject[0];
    if (!plan) { alert("ยังไม่มีแผนงานของโปรเจกต์นี้ในระบบ"); return; }
    const steps = (plan.tasks || []).filter((t) => (t.description || "").trim());
    if (steps.length === 0) { alert("แผนงานนี้ยังไม่มีรายการขั้นตอนงาน"); return; }
    setF({
      ...f,
      rows: steps.map((t) => ({
        id: uid("jr"), step: t.description, hazards: "", controls: "",
        inspector: "จป. หัวหน้างาน/วิชาชีพ",
      })),
    });
  };

  // ดึงขั้นตอนการทำงานตรงจากใบเสนอราคาของโปรเจกต์นี้ (กรณียังไม่มีแผนงาน)
  const pullStepsFromQuote = () => {
    if (!f.projectId) return;
    const quotesOfProject = (data.quotes || [])
      .filter((q) => q.projectId === f.projectId && q.kind === "quote")
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const quote = quotesOfProject[0];
    if (!quote) { alert("ยังไม่มีใบเสนอราคาของโปรเจกต์นี้ในระบบ"); return; }
    const lineItems = (quote.items || []).filter((it) => !it.isHeader && (it.desc || "").trim());
    if (lineItems.length === 0) { alert("ใบเสนอราคานี้ยังไม่มีรายการที่ดึงมาใช้ได้"); return; }
    setF({
      ...f,
      rows: lineItems.map((it) => ({
        id: uid("jr"), step: it.desc, hazards: "", controls: "",
        inspector: "จป. หัวหน้างาน/วิชาชีพ",
      })),
    });
  };

  // วิเคราะห์อันตราย+มาตรการป้องกันอัตโนมัติจากคำสำคัญในขั้นตอนงานของทุกแถว
  // (จับคู่จากคลังความรู้ในเครื่อง — ไม่ได้เรียก AI ภายนอก) ผลลัพธ์ยังแก้ไข/ตรวจสอบต่อได้ทุกจุด
  const analyzeAllRows = () => {
    setF({
      ...f,
      rows: f.rows.map((r) => {
        if (!r.step.trim()) return r;
        const { hazards, controls } = analyzeSafety(r.step);
        return {
          ...r,
          hazards: hazards.map((h, i) => `${i + 1}. ${h}`).join("\n"),
          controls: controls.map((c, i) => `${i + 1}. ${c}`).join("\n"),
        };
      }),
    });
  };

  const analyzeOneRow = (id) => {
    const row = f.rows.find((r) => r.id === id);
    if (!row || !row.step.trim()) { alert("กรอกขั้นตอนการทำงานก่อน จึงจะวิเคราะห์ได้"); return; }
    const { hazards, controls } = analyzeSafety(row.step);
    setRow(id, "hazards", hazards.map((h, i) => `${i + 1}. ${h}`).join("\n"));
    setRow(id, "controls", controls.map((c, i) => `${i + 1}. ${c}`).join("\n"));
  };

  const signer = data.signers.find((s) => s.id === f.approverId);

  return (
    <Modal title={mode === "add" ? "สร้าง JSA" : "แก้ไข JSA"} onClose={onClose} xwide>
      <form className="form" onSubmit={(e) => { e.preventDefault(); if (!f.projectId || !f.jobTitle.trim()) return; onSave(f); }}>
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
            <label>รหัส JSA</label>
            <input value={f.code} onChange={set("code")} className="mono-input" />
          </div>
          <div className="form-row">
            <label>วันที่ (Date)</label>
            <input type="date" value={f.date} onChange={set("date")} />
          </div>
        </div>

        <div className="form-grid-2">
          <div className="form-row">
            <label>ชื่องาน (Job Title) *</label>
            <input value={f.jobTitle} onChange={set("jobTitle")} placeholder="เช่น งานปรับปรุงที่อับอากาศ" required autoFocus />
          </div>
          <div className="form-row">
            <label>สถานที่ (Location)</label>
            <input value={f.location} onChange={set("location")} placeholder="เช่น RC-BE, CL-BE FP.3" />
          </div>
        </div>
        <div className="form-row">
          <label>ผู้ควบคุมงาน (Supervisor)</label>
          <input value={f.supervisorName} onChange={set("supervisorName")} placeholder="ชื่อผู้ควบคุมงานหน้างาน" />
        </div>

        <FormDivider>ตารางวิเคราะห์ความปลอดภัยในการทำงาน</FormDivider>
        <div className="jsa-toolbar-row">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={pullStepsFromPlan}
            disabled={!f.projectId}
          >⤵ ดึงขั้นตอนงานจากแผนงานของโปรเจกต์นี้</button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={pullStepsFromQuote}
            disabled={!f.projectId}
          >⤵ ดึงขั้นตอนงานจากใบเสนอราคาโดยตรง</button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={analyzeAllRows}
          >🤖 วิเคราะห์อันตราย/มาตรการทุกแถวอัตโนมัติ</button>
        </div>
        <p className="field-hint">ผลวิเคราะห์อัตโนมัติจับคู่จากคลังความรู้ความปลอดภัยงานก่อสร้างในเครื่อง — ตรวจสอบและแก้ไขให้ตรงกับหน้างานจริงก่อนใช้งานเสมอ</p>
        <div className="jsa-rows">
          <div className="jsa-row jsa-row-head">
            <span>ลำดับ</span><span>ขั้นตอนการทำงาน</span><span>อันตรายที่อาจเกิดขึ้น</span>
            <span>มาตรการป้องกันและควบคุม</span><span>ผู้ตรวจสอบ</span><span></span>
          </div>
          {f.rows.map((r, i) => (
            <div className="jsa-row" key={r.id}>
              <span className="mono-amt">{i + 1}</span>
              <textarea rows={2} value={r.step} onChange={(e) => setRow(r.id, "step", e.target.value)} placeholder="เช่น เตรียมพื้นที่ ขออนุญาตทำงาน" />
              <textarea rows={2} value={r.hazards} onChange={(e) => setRow(r.id, "hazards", e.target.value)} placeholder="เช่น บุคคลภายนอกเข้าพื้นที่" />
              <textarea rows={2} value={r.controls} onChange={(e) => setRow(r.id, "controls", e.target.value)} placeholder="เช่น จัดทำ Work Permit" />
              <input value={r.inspector} onChange={(e) => setRow(r.id, "inspector", e.target.value)} />
              <div className="jsa-row-tools">
                <button type="button" className="icon-btn" onClick={() => analyzeOneRow(r.id)} title="วิเคราะห์แถวนี้อัตโนมัติ" aria-label="วิเคราะห์อัตโนมัติ">🤖</button>
                <button type="button" className="icon-btn" onClick={() => removeRow(r.id)} aria-label="ลบ">✕</button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={addRow}>+ เพิ่มขั้นตอน</button>

        <FormDivider>ผู้อนุมัติ / ควบคุมงาน</FormDivider>
        <div className="form-grid-2">
          <div className="form-row">
            <label>ผู้อนุมัติ/ควบคุมงาน</label>
            <select value={f.approverId} onChange={set("approverId")}>
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
              แสดงรูปลายเซ็นจริงตอนพิมพ์
              {!signer?.signatureImage && <span className="field-hint"> (ยังไม่มีรูปลายเซ็นในทะเบียน)</span>}
            </label>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="btn btn-primary">บันทึก JSA</button>
        </div>
      </form>
    </Modal>
  );
}
