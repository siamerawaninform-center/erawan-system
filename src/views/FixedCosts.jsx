import { useMemo, useState } from "react";
import { TitleBlock, Modal, EmptyState, Toolbar, FormDivider, Kpi, ChipRow } from "../components/UI.jsx";
import { uid, baht, todayISO, exportToCSV } from "../lib/format.js";
import { nextFixedCostCode } from "../lib/docNumber.js";
import { FIXED_COST_CATEGORIES } from "../lib/constants.js";

/* ---------------------------------------------------------
   17 ค่าใช้จ่ายคงที่รายเดือน (Fixed Cost)
   แยกจาก "ทะเบียนหนี้สิน" โดยตั้งใจ — อันนี้คือรายจ่ายประจำที่ต้องจ่ายให้หมดทุกเดือน
   (ค่าเช่า/เงินเดือน/ค่าน้ำค่าไฟ ฯลฯ) ไม่มียอดคงเหลือสะสมแบบหนี้สิน
--------------------------------------------------------- */

export default function FixedCosts({ data, upsert, remove }) {
  const [modal, setModal] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("ทั้งหมด");
  const list = data.fixedCosts || [];

  const activeList = list.filter((f) => f.active !== false);
  const totalMonthly = activeList.reduce((s, f) => s + (Number(f.amount) || 0), 0);

  // สรุปยอดแยกตามหมวด
  const byCategory = useMemo(() => {
    const map = new Map();
    FIXED_COST_CATEGORIES.forEach((c) => map.set(c, { count: 0, amount: 0 }));
    activeList.forEach((f) => {
      const key = FIXED_COST_CATEGORIES.includes(f.category) ? f.category : "อื่นๆ";
      const row = map.get(key) || { count: 0, amount: 0 };
      row.count += 1;
      row.amount += Number(f.amount) || 0;
      map.set(key, row);
    });
    return Array.from(map.entries()).filter(([, v]) => v.count > 0);
  }, [activeList]);

  const filteredList = categoryFilter === "ทั้งหมด" ? list : list.filter((f) => f.category === categoryFilter);
  const sortedList = filteredList.slice().sort((a, b) => (Number(a.dueDay) || 99) - (Number(b.dueDay) || 99));

  return (
    <div className="view">
      <TitleBlock
        eyebrow="17 — รายจ่ายประจำ"
        title="ค่าใช้จ่ายคงที่รายเดือน"
        sheetNo={`${list.length} รายการ`}
        note="รายจ่ายประจำที่ต้องจ่ายให้หมดทุกเดือน (ค่าเช่า/เงินเดือน/ค่าน้ำไฟ ฯลฯ) — ไม่ใช่หนี้สิน ไม่มียอดคงเหลือสะสม ดูแยกจากทะเบียนหนี้สิน"
      />

      <div className="kpi-grid kpi-grid-3">
        <Kpi label="รวมค่าใช้จ่ายคงที่ต่อเดือน" value={`฿${baht(totalMonthly)}`} />
        <Kpi label="รายการที่ยังใช้งานอยู่" value={`${activeList.length} รายการ`} />
        <Kpi label="รายการทั้งหมด" value={`${list.length} รายการ`} />
      </div>

      {byCategory.length > 0 && (
        <>
          <FormDivider>สรุปยอดแยกตามหมวด</FormDivider>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>หมวด</th><th>จำนวนราย</th><th>รวมต่อเดือน</th></tr>
              </thead>
              <tbody>
                {byCategory.map(([cat, v]) => (
                  <tr key={cat}>
                    <td>{cat}</td>
                    <td className="mono-amt">{v.count}</td>
                    <td className="mono-amt">{baht(v.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <FormDivider>รายการทั้งหมด (เรียงตามวันครบกำหนดจ่าย)</FormDivider>
      <ChipRow options={FIXED_COST_CATEGORIES} value={categoryFilter} onChange={setCategoryFilter} allLabel="ทั้งหมด" scroll />

      <Toolbar>
        <span className="muted">
          {list.length === 0 ? "ยังไม่มีข้อมูลค่าใช้จ่ายคงที่" : `${filteredList.length} รายการ${categoryFilter !== "ทั้งหมด" ? ` ในหมวด "${categoryFilter}"` : ""}`}
        </span>
        <button
          className="btn btn-ghost"
          onClick={() => {
            const headers = ["รหัส", "หมวด", "รายการ", "จำนวนเงิน/เดือน", "วันครบกำหนดจ่าย", "สถานะ", "หมายเหตุ"];
            const rows = sortedList.map((f) => [
              f.code, f.category, f.name || "", f.amount || "",
              f.dueDay || "", f.active === false ? "หยุดใช้งานแล้ว" : "ใช้งานอยู่", f.note || "",
            ]);
            exportToCSV(`ค่าใช้จ่ายคงที่รายเดือน-${todayISO()}`, headers, rows);
          }}
        >⬇ Export CSV</button>
        <button className="btn btn-primary" onClick={() => setModal({ mode: "add" })}>+ เพิ่มรายการ</button>
      </Toolbar>

      {list.length === 0 ? (
        <EmptyState
          title="ยังไม่มีข้อมูลค่าใช้จ่ายคงที่ในระบบ"
          body="บันทึกรายจ่ายประจำทุกเดือน เช่น ค่าเช่าสำนักงาน เงินเดือนพนักงาน ค่าน้ำ ค่าไฟ ค่าเน็ต ประกันภัย จะได้รู้ล่วงหน้าว่าแต่ละเดือนต้องเตรียมเงินเท่าไหร่"
          actionLabel="+ เพิ่มรายการแรก"
          onAction={() => setModal({ mode: "add" })}
        />
      ) : sortedList.length === 0 ? (
        <EmptyState
          title={`ไม่มีรายการในหมวด "${categoryFilter}"`}
          body="ลองเลือกหมวดอื่น หรือกด “ทั้งหมด” เพื่อดูทุกรายการ"
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>รหัส</th><th>หมวด</th><th>รายการ</th><th>จำนวนเงิน/เดือน</th>
                <th>วันครบกำหนดจ่าย</th><th>สถานะ</th><th></th>
              </tr>
            </thead>
            <tbody>
              {sortedList.map((f) => (
                <tr key={f.id} style={f.active === false ? { opacity: 0.5 } : undefined}>
                  <td className="mono-code">{f.code}</td>
                  <td>{f.category}</td>
                  <td>{f.name || "—"}</td>
                  <td className="mono-amt">{baht(f.amount)}</td>
                  <td>{f.dueDay ? `วันที่ ${f.dueDay}` : "—"}</td>
                  <td>{f.active === false ? "หยุดใช้งานแล้ว" : "ใช้งานอยู่"}</td>
                  <td className="row-actions">
                    <button className="icon-btn" onClick={() => setModal({ mode: "edit", item: f })} aria-label="แก้ไข">✎</button>
                    <button
                      className="icon-btn"
                      onClick={() => { if (confirm(`ลบรายการ "${f.name || f.code}"?`)) remove("fixedCosts", f.id, "ค่าใช้จ่ายคงที่"); }}
                      aria-label="ลบ"
                    >🗑</button>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} style={{ textAlign: "right", fontWeight: 700 }}>รวม (เฉพาะที่ใช้งานอยู่)</td>
                <td className="mono-amt" style={{ fontWeight: 700 }}>{baht(totalMonthly)}</td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <FixedCostForm
          mode={modal.mode}
          item={modal.item}
          data={data}
          onSave={(item) => { upsert("fixedCosts", item, "ค่าใช้จ่ายคงที่"); setModal(null); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function FixedCostForm({ mode, item, data, onSave, onClose }) {
  const [f, setF] = useState(() => {
    const defaults = {
      id: uid("fixcost"),
      code: nextFixedCostCode(data.fixedCosts),
      category: FIXED_COST_CATEGORIES[0],
      name: "",
      amount: "",
      dueDay: "",
      active: true,
      note: "",
    };
    return item ? { ...defaults, ...item } : defaults;
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <Modal title={mode === "add" ? "เพิ่มค่าใช้จ่ายคงที่รายเดือน" : "แก้ไขค่าใช้จ่ายคงที่รายเดือน"} onClose={onClose} wide>
      <form className="form" onSubmit={(e) => { e.preventDefault(); if (!f.name.trim() || !f.amount) return; onSave(f); }}>
        <div className="form-grid-3">
          <div className="form-row">
            <label>รหัส</label>
            <input value={f.code} onChange={set("code")} className="mono-input" />
          </div>
          <div className="form-row">
            <label>หมวด</label>
            <select value={f.category} onChange={set("category")}>
              {FIXED_COST_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>สถานะ</label>
            <select value={f.active ? "1" : "0"} onChange={(e) => setF({ ...f, active: e.target.value === "1" })}>
              <option value="1">ใช้งานอยู่ (นับรวมในยอดรวม)</option>
              <option value="0">หยุดใช้งานแล้ว (ไม่นับรวม)</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <label>รายการ *</label>
          <input value={f.name} onChange={set("name")} placeholder="เช่น ค่าเช่าสำนักงาน, เงินเดือนช่าง 2 คน" required autoFocus />
        </div>

        <div className="form-grid-3">
          <div className="form-row">
            <label>จำนวนเงินต่อเดือน (บาท) *</label>
            <input type="number" min="0" step="0.01" value={f.amount} onChange={set("amount")} required />
          </div>
          <div className="form-row">
            <label>วันที่ครบกำหนดจ่ายในแต่ละเดือน (1-31)</label>
            <input type="number" min="1" max="31" value={f.dueDay} onChange={set("dueDay")} placeholder="เช่น 5" />
          </div>
        </div>

        <div className="form-row">
          <label>หมายเหตุ</label>
          <textarea rows={2} value={f.note} onChange={set("note")} placeholder="เช่น จ่ายผ่านบัญชีไหน โอนให้ใคร" />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="btn btn-primary">บันทึก</button>
        </div>
      </form>
    </Modal>
  );
}
