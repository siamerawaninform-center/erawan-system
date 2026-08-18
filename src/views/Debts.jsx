import { useState } from "react";
import { TitleBlock, Modal, EmptyState, Toolbar, Stamp, FormDivider, Kpi } from "../components/UI.jsx";
import { uid, baht, todayISO, formatShortThaiDate, exportToCSV } from "../lib/format.js";
import { nextDebtCode } from "../lib/docNumber.js";
import { DEBT_TYPES } from "../lib/constants.js";

/* ---------------------------------------------------------
   15 ทะเบียนหนี้สิน — ติดตามภาระหนี้ทั้งในและนอกระบบ
--------------------------------------------------------- */

function debtStatusVariant(status) {
  if (status === "ชำระหมดแล้ว") return "ok";
  if (status === "ค้างชำระ") return "warn";
  return "steel";
}

export default function Debts({ data, upsert, remove }) {
  const [modal, setModal] = useState(null);
  const list = data.debts || [];

  const activeDebts = list.filter((d) => d.status !== "ชำระหมดแล้ว");
  const totalBalance = activeDebts.reduce((s, d) => s + (Number(d.balance) || 0), 0);
  const totalMonthly = activeDebts.reduce((s, d) => s + (Number(d.monthlyPayment) || 0), 0);

  return (
    <div className="view">
      <TitleBlock
        eyebrow="15 — ภาระหนี้สิน"
        title="ทะเบียนหนี้สิน"
        sheetNo={`${list.length} รายการ`}
        note="ติดตามภาระหนี้ทั้งในระบบและนอกระบบ ใช้วางแผนกระแสเงินสดล่วงหน้า"
      />

      <div className="kpi-grid kpi-grid-3">
        <Kpi label="ยอดหนี้คงเหลือรวม" value={`฿${baht(totalBalance)}`} />
        <Kpi label="ภาระผ่อนต่อเดือนรวม" value={`฿${baht(totalMonthly)}`} />
        <Kpi label="เจ้าหนี้ที่ยังมีภาระอยู่" value={`${activeDebts.length} ราย`} />
      </div>

      <Toolbar>
        <span className="muted">{list.length === 0 ? "ยังไม่มีข้อมูลหนี้สิน" : `${activeDebts.length} รายการยังมีภาระ`}</span>
        <button
          className="btn btn-ghost"
          onClick={() => {
            const headers = ["รหัส", "ประเภท", "เจ้าหนี้", "เงินต้น", "ดอกเบี้ย (%)", "ค่างวด/เดือน", "ยอดคงเหลือ", "วันที่เริ่ม", "ครบกำหนด", "สถานะ"];
            const rows = list.map((d) => [
              d.code, d.type, d.creditorName || "", d.principal || "", d.interestRate || "",
              d.monthlyPayment || "", d.balance || "", d.startDate || "", d.dueDate || "", d.status,
            ]);
            exportToCSV(`ทะเบียนหนี้สิน-${todayISO()}`, headers, rows);
          }}
        >⬇ Export CSV</button>
        <button className="btn btn-primary" onClick={() => setModal({ mode: "add" })}>+ เพิ่มรายการหนี้สิน</button>
      </Toolbar>

      {list.length === 0 ? (
        <EmptyState
          title="ยังไม่มีข้อมูลหนี้สินในระบบ"
          body="บันทึกภาระหนี้ทั้งในระบบ (ธนาคาร/ลีสซิ่ง) และนอกระบบ เพื่อดูภาพรวมภาระผ่อนต่อเดือนและวางแผนกระแสเงินสด"
          actionLabel="+ เพิ่มรายการแรก"
          onAction={() => setModal({ mode: "add" })}
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>รหัส</th><th>ประเภท</th><th>เจ้าหนี้</th><th>เงินต้น</th>
                <th>ดอกเบี้ย</th><th>ค่างวด/เดือน</th><th>ยอดคงเหลือ</th><th>ครบกำหนด</th><th>สถานะ</th><th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id}>
                  <td className="mono-code">{d.code}</td>
                  <td>{d.type}</td>
                  <td>{d.creditorName || "—"}</td>
                  <td className="mono-amt">{baht(d.principal)}</td>
                  <td className="mono-amt">{d.interestRate ? `${d.interestRate}%` : "—"}</td>
                  <td className="mono-amt">{baht(d.monthlyPayment)}</td>
                  <td className="mono-amt">{baht(d.balance)}</td>
                  <td>{formatShortThaiDate(d.dueDate) || "—"}</td>
                  <td><Stamp label={d.status} variant={debtStatusVariant(d.status)} /></td>
                  <td className="row-actions">
                    <button className="icon-btn" onClick={() => setModal({ mode: "edit", item: d })} aria-label="แก้ไข">✎</button>
                    <button
                      className="icon-btn"
                      onClick={() => { if (confirm(`ลบรายการ "${d.code}"?`)) remove("debts", d.id, "หนี้สิน"); }}
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
        <DebtForm
          mode={modal.mode}
          item={modal.item}
          data={data}
          onSave={(item) => { upsert("debts", item, "หนี้สิน"); setModal(null); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function DebtForm({ mode, item, data, onSave, onClose }) {
  const [f, setF] = useState(() => {
    const defaults = {
      id: uid("debt"),
      code: nextDebtCode(data.debts),
      type: DEBT_TYPES[0],
      creditorName: "",
      principal: "",
      interestRate: "",
      monthlyPayment: "",
      balance: "",
      startDate: todayISO(),
      dueDate: "",
      status: "ยังมีภาระ",
      note: "",
    };
    return item ? { ...defaults, ...item } : defaults;
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <Modal title={mode === "add" ? "เพิ่มรายการหนี้สิน" : "แก้ไขรายการหนี้สิน"} onClose={onClose} wide>
      <form className="form" onSubmit={(e) => { e.preventDefault(); if (!f.creditorName.trim()) return; onSave(f); }}>
        <div className="form-grid-3">
          <div className="form-row">
            <label>รหัส</label>
            <input value={f.code} onChange={set("code")} className="mono-input" />
          </div>
          <div className="form-row">
            <label>ประเภทหนี้สิน</label>
            <select value={f.type} onChange={set("type")}>
              {DEBT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>สถานะ</label>
            <select value={f.status} onChange={set("status")}>
              <option value="ยังมีภาระ">ยังมีภาระ</option>
              <option value="ค้างชำระ">ค้างชำระ</option>
              <option value="ชำระหมดแล้ว">ชำระหมดแล้ว</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <label>เจ้าหนี้ / ผู้ให้กู้ *</label>
          <input value={f.creditorName} onChange={set("creditorName")} placeholder="เช่น ธนาคารกสิกรไทย หรือ ชื่อบุคคล" required autoFocus />
        </div>

        <FormDivider>รายละเอียดหนี้</FormDivider>
        <div className="form-grid-3">
          <div className="form-row">
            <label>เงินต้น (บาท)</label>
            <input type="number" min="0" step="0.01" value={f.principal} onChange={set("principal")} />
          </div>
          <div className="form-row">
            <label>อัตราดอกเบี้ย (% ต่อปี)</label>
            <input type="number" min="0" step="0.01" value={f.interestRate} onChange={set("interestRate")} />
          </div>
          <div className="form-row">
            <label>ค่างวดต่อเดือน (บาท)</label>
            <input type="number" min="0" step="0.01" value={f.monthlyPayment} onChange={set("monthlyPayment")} />
          </div>
        </div>
        <div className="form-grid-3">
          <div className="form-row">
            <label>ยอดคงเหลือปัจจุบัน (บาท)</label>
            <input type="number" min="0" step="0.01" value={f.balance} onChange={set("balance")} />
          </div>
          <div className="form-row">
            <label>วันที่เริ่มก่อหนี้</label>
            <input type="date" value={f.startDate} onChange={set("startDate")} />
          </div>
          <div className="form-row">
            <label>วันครบกำหนดชำระหมด</label>
            <input type="date" value={f.dueDate} onChange={set("dueDate")} />
          </div>
        </div>

        <div className="form-row">
          <label>หมายเหตุ</label>
          <textarea rows={2} value={f.note} onChange={set("note")} placeholder="เช่น เลขที่สัญญา ชื่อผู้ค้ำประกัน" />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="btn btn-primary">บันทึกรายการหนี้สิน</button>
        </div>
      </form>
    </Modal>
  );
}
