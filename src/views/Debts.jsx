import { useMemo, useState } from "react";
import { TitleBlock, Modal, EmptyState, Toolbar, Stamp, FormDivider, Kpi, ChipRow } from "../components/UI.jsx";
import { uid, baht, todayISO, formatShortThaiDate, exportToCSV } from "../lib/format.js";
import { nextDebtCode } from "../lib/docNumber.js";
import { DEBT_TYPES } from "../lib/constants.js";

/* ---------------------------------------------------------
   15 ทะเบียนหนี้สิน — ติดตามภาระหนี้ทั้งในและนอกระบบ
   - แบ่งหมวดหนี้ ดูยอดคงเหลือแยกตามหมวดได้
   - แยกเงินต้น กับ ดอกเบี้ยสะสมที่ค้างอยู่ตอนนี้ เป็นคนละช่อง (ไม่ปนกัน)
   - มีสรุปภาระ fix cost ที่ต้องจ่ายทุกเดือน จะได้รู้ล่วงหน้าว่าเดือนนี้ต้องจ่ายอะไรบ้าง
--------------------------------------------------------- */

function debtStatusVariant(status) {
  if (status === "ชำระหมดแล้ว") return "ok";
  if (status === "ค้างชำระ") return "warn";
  return "steel";
}

export default function Debts({ data, upsert, remove }) {
  const [modal, setModal] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("ทั้งหมด");
  const list = data.debts || [];

  const activeDebts = list.filter((d) => d.status !== "ชำระหมดแล้ว");
  const totalBalance = activeDebts.reduce((s, d) => s + (Number(d.balance) || 0), 0);
  const totalAccruedInterest = activeDebts.reduce((s, d) => s + (Number(d.accruedInterest) || 0), 0);
  const totalMonthly = activeDebts.reduce((s, d) => s + (Number(d.monthlyPayment) || 0), 0);

  // ยอดหนี้คงเหลือ แยกตามหมวด — เอาไว้ดูว่าหมวดไหนแบกภาระหนักสุด
  const byCategory = useMemo(() => {
    const map = new Map();
    DEBT_TYPES.forEach((t) => map.set(t, { count: 0, balance: 0, accrued: 0 }));
    activeDebts.forEach((d) => {
      const key = DEBT_TYPES.includes(d.type) ? d.type : "อื่นๆ";
      const row = map.get(key) || { count: 0, balance: 0, accrued: 0 };
      row.count += 1;
      row.balance += Number(d.balance) || 0;
      row.accrued += Number(d.accruedInterest) || 0;
      map.set(key, row);
    });
    return Array.from(map.entries()).filter(([, v]) => v.count > 0);
  }, [activeDebts]);

  const filteredList = categoryFilter === "ทั้งหมด" ? list : list.filter((d) => d.type === categoryFilter);

  // ภาระ fix cost รายเดือน — เฉพาะรายการที่ยังมีภาระและมีค่างวด/เดือน เรียงตามวันที่ครบกำหนดของแต่ละเดือน
  const fixedCostList = activeDebts
    .filter((d) => Number(d.monthlyPayment) > 0)
    .slice()
    .sort((a, b) => (Number(a.paymentDueDay) || 99) - (Number(b.paymentDueDay) || 99));

  return (
    <div className="view">
      <TitleBlock
        eyebrow="16 — ภาระหนี้สิน"
        title="ทะเบียนหนี้สิน"
        sheetNo={`${list.length} รายการ`}
        note="ติดตามภาระหนี้ทั้งในระบบและนอกระบบ ใช้วางแผนกระแสเงินสดล่วงหน้า"
      />

      <div className="kpi-grid kpi-grid-3">
        <Kpi label="ยอดเงินต้นคงเหลือรวม" value={`฿${baht(totalBalance)}`} />
        <Kpi label="ดอกเบี้ยสะสมค้างรวม" value={`฿${baht(totalAccruedInterest)}`} />
        <Kpi label="ภาระ Fix Cost รวมต่อเดือน" value={`฿${baht(totalMonthly)}`} />
      </div>

      {byCategory.length > 0 && (
        <>
          <FormDivider>ยอดหนี้คงเหลือแยกตามหมวด</FormDivider>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>หมวดหนี้สิน</th><th>จำนวนราย</th><th>เงินต้นคงเหลือ</th><th>ดอกเบี้ยสะสมค้าง</th><th>รวมภาระ</th></tr>
              </thead>
              <tbody>
                {byCategory.map(([cat, v]) => (
                  <tr key={cat}>
                    <td>{cat}</td>
                    <td className="mono-amt">{v.count}</td>
                    <td className="mono-amt">{baht(v.balance)}</td>
                    <td className="mono-amt">{baht(v.accrued)}</td>
                    <td className="mono-amt">{baht(v.balance + v.accrued)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {fixedCostList.length > 0 && (
        <>
          <FormDivider>ภาระ Fix Cost รายเดือน (ต้องจ่ายทุกเดือน)</FormDivider>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>วันที่ครบกำหนด (ทุกเดือน)</th><th>เจ้าหนี้</th><th>ประเภท</th><th>ค่างวด/เดือน</th></tr>
              </thead>
              <tbody>
                {fixedCostList.map((d) => (
                  <tr key={d.id}>
                    <td>{d.paymentDueDay ? `วันที่ ${d.paymentDueDay}` : "—"}</td>
                    <td>{d.creditorName || "—"}</td>
                    <td>{d.type}</td>
                    <td className="mono-amt">{baht(d.monthlyPayment)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} style={{ textAlign: "right", fontWeight: 700 }}>รวม Fix Cost ต่อเดือน</td>
                  <td className="mono-amt" style={{ fontWeight: 700 }}>{baht(totalMonthly)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      <FormDivider>รายการหนี้สินทั้งหมด</FormDivider>
      <ChipRow options={DEBT_TYPES} value={categoryFilter} onChange={setCategoryFilter} allLabel="ทั้งหมด" scroll />

      <Toolbar>
        <span className="muted">
          {list.length === 0 ? "ยังไม่มีข้อมูลหนี้สิน" : `${filteredList.length} รายการ${categoryFilter !== "ทั้งหมด" ? ` ในหมวด "${categoryFilter}"` : ""}`}
        </span>
        <button
          className="btn btn-ghost"
          onClick={() => {
            const headers = ["รหัส", "ประเภท", "เจ้าหนี้", "เงินต้น", "ดอกเบี้ยสะสมค้าง", "อัตราดอกเบี้ย (%)", "ค่างวด/เดือน", "วันครบกำหนดจ่ายรายเดือน", "ยอดคงเหลือ", "วันที่เริ่ม", "ครบกำหนด", "สถานะ"];
            const rows = filteredList.map((d) => [
              d.code, d.type, d.creditorName || "", d.principal || "", d.accruedInterest || "",
              d.interestRate || "", d.monthlyPayment || "", d.paymentDueDay || "",
              d.balance || "", d.startDate || "", d.dueDate || "", d.status,
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
      ) : filteredList.length === 0 ? (
        <EmptyState
          title={`ไม่มีรายการหนี้สินในหมวด "${categoryFilter}"`}
          body="ลองเลือกหมวดอื่น หรือกด “ทั้งหมด” เพื่อดูทุกรายการ"
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>รหัส</th><th>ประเภท</th><th>เจ้าหนี้</th><th>เงินต้น</th>
                <th>ดอกเบี้ยสะสมค้าง</th><th>ค่างวด/เดือน</th><th>ยอดคงเหลือ</th><th>ครบกำหนด</th><th>สถานะ</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((d) => (
                <tr key={d.id}>
                  <td className="mono-code">{d.code}</td>
                  <td>{d.type}</td>
                  <td>{d.creditorName || "—"}</td>
                  <td className="mono-amt">{baht(d.principal)}</td>
                  <td className="mono-amt">{baht(d.accruedInterest)}</td>
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
      accruedInterest: "",
      interestRate: "",
      monthlyPayment: "",
      paymentDueDay: "",
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
            <label>หมวดหนี้สิน</label>
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

        <FormDivider>เงินต้น / ดอกเบี้ย</FormDivider>
        <div className="form-grid-3">
          <div className="form-row">
            <label>เงินต้น (บาท)</label>
            <input type="number" min="0" step="0.01" value={f.principal} onChange={set("principal")} />
          </div>
          <div className="form-row">
            <label>ดอกเบี้ยสะสมที่ค้างอยู่ตอนนี้ (บาท)</label>
            <input type="number" min="0" step="0.01" value={f.accruedInterest} onChange={set("accruedInterest")} placeholder="ยอดดอกเบี้ยที่ค้างจ่ายจริง ไม่ใช่ % " />
          </div>
          <div className="form-row">
            <label>อัตราดอกเบี้ย (% ต่อปี)</label>
            <input type="number" min="0" step="0.01" value={f.interestRate} onChange={set("interestRate")} />
          </div>
        </div>
        <p className="field-hint">"ดอกเบี้ยสะสมที่ค้างอยู่" คือยอดดอกเบี้ยจริงที่ค้างจ่าย ณ ตอนนี้ (หน่วยบาท) แยกต่างหากจากเงินต้น ไม่ต้องคำนวณเอง กรอกยอดจากใบแจ้งหนี้/statement ล่าสุดได้เลย</p>

        <FormDivider>ภาระ Fix Cost รายเดือน</FormDivider>
        <div className="form-grid-3">
          <div className="form-row">
            <label>ค่างวดต่อเดือน (บาท)</label>
            <input type="number" min="0" step="0.01" value={f.monthlyPayment} onChange={set("monthlyPayment")} />
          </div>
          <div className="form-row">
            <label>วันที่ครบกำหนดจ่ายในแต่ละเดือน (1-31)</label>
            <input type="number" min="1" max="31" value={f.paymentDueDay} onChange={set("paymentDueDay")} placeholder="เช่น 5" />
          </div>
          <div className="form-row">
            <label>ยอดคงเหลือปัจจุบัน (บาท)</label>
            <input type="number" min="0" step="0.01" value={f.balance} onChange={set("balance")} />
          </div>
        </div>

        <div className="form-grid-3">
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
