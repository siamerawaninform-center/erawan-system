import { useState } from "react";
import { TitleBlock, Modal, EmptyState, Toolbar, ChipRow, Stamp, FormDivider } from "../components/UI.jsx";
import { Autocomplete } from "../components/Autocomplete.jsx";
import { uid, baht, todayISO, formatShortThaiDate, computeExpenseTotal, exportToCSV, monthKey, formatThaiMonthYear } from "../lib/format.js";
import { nextExpenseCode, nextWhtCertNo } from "../lib/docNumber.js";
import { EXPENSE_CATEGORIES, WHT_RATES, WHT_INCOME_TYPES, WHT_PND_TYPES, WHT_ISSUE_TYPES } from "../lib/constants.js";
import { openWhtCertPrint } from "../components/PrintWHT.jsx";

/* ---------------------------------------------------------
   13 รายจ่าย / ภาษีซื้อ / หัก ณ ที่จ่าย
   บันทึกทีละใบสะสมไปเรื่อยๆ ระหว่างเดือน แล้วสรุปที่คลังเอกสารรายเดือน
--------------------------------------------------------- */

function expenseStatusVariant(hasWht, hasVat) {
  if (hasWht) return "maroon";
  if (hasVat) return "ok";
  return "steel";
}

export default function Expenses({ data, upsert, remove }) {
  const [modal, setModal] = useState(null);
  const [filterCat, setFilterCat] = useState("ทั้งหมด");
  const [q, setQ] = useState("");
  const [collapsed, setCollapsed] = useState({});
  const list = data.expenses || [];
  const supplier = (id) => data.suppliers.find((s) => s.id === id);
  const project = (id) => data.projects.find((p) => p.id === id);

  const handlePrintWht = (e) => openWhtCertPrint({ expense: e, data, supplier });

  const filtered = list
    .filter((e) => filterCat === "ทั้งหมด" || e.category === filterCat)
    .filter((e) => {
      const vendorText = e.vendorId ? supplier(e.vendorId)?.nameTh || "" : e.vendorName || "";
      return `${e.code} ${vendorText} ${e.description || ""}`.toLowerCase().includes(q.toLowerCase());
    })
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const monthTotal = filtered.reduce((s, e) => s + computeExpenseTotal(e.amount, e.vat, e.whtApplicable, e.whtRate).totalWithVat, 0);

  // จัดกลุ่มเป็น "โฟลเดอร์" ตามเดือนภาษี (เดือน+ปี) — คำนวณจากวันที่ใบกำกับภาษีทุกครั้ง
  // ช่วยเช็คยอดตอนยื่น ภ.พ.30 รายเดือน และดูสัดส่วนรายปีได้ชัดเจน
  const groupMap = {};
  filtered.forEach((e) => {
    const key = monthKey(e.date) || "ไม่ระบุวันที่";
    (groupMap[key] = groupMap[key] || []).push(e);
  });
  const monthGroups = Object.keys(groupMap)
    .sort((a, b) => b.localeCompare(a))
    .map((key) => ({ key, items: groupMap[key] }));

  const toggleGroup = (key, isNewest) =>
    setCollapsed({ ...collapsed, [key]: collapsed[key] === undefined ? isNewest : !collapsed[key] });
  const isGroupCollapsed = (key, isNewest) =>
    collapsed[key] === undefined ? !isNewest : collapsed[key];

  const groupSummary = (items) => {
    const base = items.reduce((s, e) => s + computeExpenseTotal(e.amount, e.vat, e.whtApplicable, e.whtRate).base, 0);
    const vatAmt = items.reduce((s, e) => s + (e.vat ? computeExpenseTotal(e.amount, e.vat, e.whtApplicable, e.whtRate).vatAmount : 0), 0);
    const netPaid = items.reduce((s, e) => s + computeExpenseTotal(e.amount, e.vat, e.whtApplicable, e.whtRate).netPaid, 0);
    return { base, vatAmt, netPaid };
  };

  const handleExportCSV = () => {
    const headers = [
      "รหัส", "วันที่", "ผู้ขาย", "เลขผู้เสียภาษีผู้ขาย", "เลขที่ใบกำกับภาษี",
      "หมวด", "โปรเจกต์", "รายละเอียด",
      "มูลค่าก่อนภาษี", "VAT", "หัก ณ ที่จ่าย (%)", "จำนวนหัก ณ ที่จ่าย", "สุทธิที่จ่าย",
    ];
    const rows = filtered.map((e) => {
      const t = computeExpenseTotal(e.amount, e.vat, e.whtApplicable, e.whtRate);
      const vendorText = e.vendorId ? supplier(e.vendorId)?.nameTh : e.vendorName;
      const vendorTax = e.vendorId ? supplier(e.vendorId)?.taxId : e.vendorTaxId;
      const proj = project(e.projectId);
      return [
        e.code, e.date, vendorText || "", vendorTax || "", e.vendorInvoiceNo || "",
        e.category, proj ? `${proj.code} ${proj.name}` : "", e.description || "",
        t.base.toFixed(2), e.vat ? t.vatAmount.toFixed(2) : "0",
        e.whtApplicable ? e.whtRate : "0", e.whtApplicable ? t.whtAmount.toFixed(2) : "0",
        t.netPaid.toFixed(2),
      ];
    });
    exportToCSV(`รายจ่าย-ภาษีซื้อ-${todayISO()}`, headers, rows);
  };

  return (
    <div className="view">
      <TitleBlock
        eyebrow="13 — รายจ่าย/ภาษีซื้อ"
        title="รายจ่าย / ภาษีซื้อ / หัก ณ ที่จ่าย"
        sheetNo={`${filtered.length}/${list.length}`}
        note="บันทึกใบกำกับภาษีซื้อที่ได้รับจากผู้ขายทีละใบ สะสมไว้ใช้สรุปส่งบัญชีรายเดือนที่เมนู 'คลังเอกสารรายเดือน'"
      />

      <div className="kpi-grid kpi-grid-3">
        <div className="kpi"><span className="kpi-label">รายการที่กรอง</span><span className="kpi-value">{filtered.length}</span></div>
        <div className="kpi"><span className="kpi-label">ยอดรวม (รวม VAT)</span><span className="kpi-value">฿{baht(monthTotal)}</span></div>
        <div className="kpi"><span className="kpi-label">รายการทั้งหมดในระบบ</span><span className="kpi-value">{list.length}</span></div>
      </div>

      <Toolbar>
        <input
          className="search"
          placeholder="ค้นหาเลขที่ ผู้ขาย หรือรายละเอียด…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn btn-ghost" onClick={handleExportCSV}>⬇ Export CSV</button>
        <button className="btn btn-primary" onClick={() => setModal({ mode: "add" })}>
          + บันทึกรายจ่าย
        </button>
      </Toolbar>

      <ChipRow options={EXPENSE_CATEGORIES} value={filterCat} onChange={setFilterCat} scroll />

      {list.length === 0 ? (
        <EmptyState
          title="ยังไม่มีรายจ่ายในระบบ"
          body="บันทึกใบกำกับภาษีซื้อทีละใบที่ได้รับจากผู้ขาย/ผู้รับเหมาช่วง เพื่อใช้คำนวณภาษีซื้อและหัก ณ ที่จ่ายรายเดือน"
          actionLabel="+ บันทึกรายจ่ายแรก"
          onAction={() => setModal({ mode: "add" })}
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="ไม่พบรายการที่ค้นหา" body="ลองค้นหาด้วยคำอื่นหรือเปลี่ยนหมวดหมู่" />
      ) : (
        <div className="project-groups">
          {monthGroups.map((g, idx) => {
            const isNewest = idx === 0;
            const closed = isGroupCollapsed(g.key, isNewest);
            const monthLabel = g.key === "ไม่ระบุวันที่" ? g.key : formatThaiMonthYear(g.key);
            const sum = groupSummary(g.items);
            return (
              <div className="project-group" key={g.key}>
                <button className="project-group-head" onClick={() => toggleGroup(g.key, isNewest)}>
                  <span className={`pg-arrow ${closed ? "pg-arrow-closed" : ""}`}>▾</span>
                  <span className="pg-month-label">{monthLabel}</span>
                  <span className="pg-count">{g.items.length} รายการ</span>
                  <span className="pg-count mono-amt">มูลค่าก่อนภาษี ฿{baht(sum.base)}</span>
                  <span className="pg-count mono-amt">VAT ฿{baht(sum.vatAmt)}</span>
                  <span className="pg-count mono-amt">สุทธิที่จ่าย ฿{baht(sum.netPaid)}</span>
                </button>
                {!closed && (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>รหัส</th><th>วันที่</th><th>ผู้ขาย</th><th>หมวด</th><th>โปรเจกต์</th>
                          <th>มูลค่าก่อนภาษี</th><th>VAT</th><th>หัก ณ ที่จ่าย</th><th>สุทธิที่จ่าย</th><th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.items.map((e) => {
                          const t = computeExpenseTotal(e.amount, e.vat, e.whtApplicable, e.whtRate);
                          const vendorText = e.vendorId ? supplier(e.vendorId)?.nameTh : e.vendorName;
                          const proj = project(e.projectId);
                          return (
                            <tr key={e.id}>
                              <td className="mono-code">{e.code}</td>
                              <td>{formatShortThaiDate(e.date)}</td>
                              <td>{vendorText || "—"}</td>
                              <td><Stamp label={e.category} variant={expenseStatusVariant(e.whtApplicable, e.vat)} /></td>
                              <td>{proj ? proj.code : <span className="muted">ทั่วไป</span>}</td>
                              <td className="mono-amt">{baht(t.base)}</td>
                              <td className="mono-amt">{e.vat ? baht(t.vatAmount) : "—"}</td>
                              <td className="mono-amt">{e.whtApplicable ? `${e.whtRate}% (${baht(t.whtAmount)})` : "—"}</td>
                              <td className="mono-amt">{baht(t.netPaid)}</td>
                              <td className="row-actions">
                                <button className="icon-btn" onClick={() => setModal({ mode: "edit", item: e })} aria-label="แก้ไข">✎</button>
                                {e.whtApplicable && (
                                  <button className="icon-btn" onClick={() => handlePrintWht(e)} aria-label="พิมพ์ 50 ทวิ" title="พิมพ์หนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ)">🖶</button>
                                )}
                                <button
                                  className="icon-btn"
                                  onClick={() => { if (confirm(`ลบรายการ "${e.code}"?`)) remove("expenses", e.id, "รายจ่าย"); }}
                                  aria-label="ลบ"
                                >🗑</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <ExpenseForm
          mode={modal.mode}
          item={modal.item}
          data={data}
          onSave={(item) => { upsert("expenses", item, "รายจ่าย"); setModal(null); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function ExpenseForm({ mode, item, data, onSave, onClose }) {
  const [f, setF] = useState(() => {
    const today = todayISO();
    const defaults = {
      id: uid("exp"),
      code: nextExpenseCode(data.expenses, today),
      date: today,
      vendorId: "",
      vendorName: "",
      vendorTaxId: "",
      vendorInvoiceNo: "",
      category: EXPENSE_CATEGORIES[0],
      projectId: "",
      description: "",
      amount: "",
      vat: true,
      whtApplicable: false,
      whtRate: 3,
      whtIncomeRow: WHT_INCOME_TYPES[5].row, // ค่าเริ่มต้น: ข้อ 5 (ค่าจ้างทำของ/บริการ/เช่า/ขนส่ง — พบบ่อยสุดสำหรับงานก่อสร้าง)
      whtCertNo: nextWhtCertNo(data.expenses, today),
      bookNo: "",
      pndType: "ภ.ง.ด.53",
      issueType: "หัก ณ ที่จ่าย",
      signerId: data.signers.find((s) => s.isDefault)?.id || "",
      showSignature: false,
      note: "",
    };
    // รายการเก่าที่สร้างไว้ก่อนมีช่องพวกนี้ จะได้ค่าเริ่มต้นเติมให้ครบแทนที่จะว่างเปล่า
    return item ? { ...defaults, ...item } : defaults;
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const changeVendor = (vendorId) => {
    const v = data.suppliers.find((s) => s.id === vendorId);
    setF({
      ...f,
      vendorId,
      vendorTaxId: v?.taxId || f.vendorTaxId,
      category: v?.category || f.category,
      whtRate: v?.defaultWht ? Number(v.defaultWht) : f.whtRate,
    });
  };

  const t = computeExpenseTotal(f.amount, f.vat, f.whtApplicable, f.whtRate);

  return (
    <Modal title={mode === "add" ? "บันทึกรายจ่าย" : "แก้ไขรายจ่าย"} onClose={onClose} wide>
      <form
        className="form"
        onSubmit={(e) => { e.preventDefault(); if (!f.amount) return; onSave(f); }}
      >
        <div className="form-grid-3">
          <div className="form-row">
            <label>เลขที่รายการ</label>
            <input value={f.code} onChange={set("code")} className="mono-input" />
          </div>
          <div className="form-row">
            <label>วันที่ใบกำกับภาษี</label>
            <input type="date" value={f.date} onChange={set("date")} />
          </div>
          <div className="form-row">
            <label>เลขที่ใบกำกับภาษีจากผู้ขาย</label>
            <input value={f.vendorInvoiceNo} onChange={set("vendorInvoiceNo")} className="mono-input" placeholder="เลขที่บนใบกำกับภาษีที่ได้รับ" />
          </div>
        </div>

        <div className="form-grid-2">
          <div className="form-row">
            <label>ผู้ขาย (จากทะเบียน — พิมพ์เพื่อค้นหา)</label>
            <Autocomplete
              options={data.suppliers.map((s) => ({ id: s.id, label: s.nameTh, sublabel: s.code }))}
              value={f.vendorId}
              onChange={changeVendor}
              placeholder="พิมพ์ชื่อผู้ขาย…"
            />
          </div>
          <div className="form-row">
            <label>หรือพิมพ์ชื่อผู้ขายเอง</label>
            <input
              value={f.vendorName}
              onChange={set("vendorName")}
              placeholder="ใช้เมื่อยังไม่ได้เพิ่มในทะเบียน"
              disabled={!!f.vendorId}
            />
          </div>
        </div>

        <div className="form-grid-3">
          <div className="form-row">
            <label>เลขผู้เสียภาษีผู้ขาย</label>
            <input value={f.vendorTaxId} onChange={set("vendorTaxId")} className="mono-input" placeholder="เลข 13 หลัก" />
          </div>
          <div className="form-row">
            <label>หมวดหมู่</label>
            <select value={f.category} onChange={set("category")}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>โปรเจกต์ (ไม่บังคับ — พิมพ์เพื่อค้นหา)</label>
            <Autocomplete
              options={data.projects.map((p) => ({ id: p.id, label: p.name, sublabel: p.code }))}
              value={f.projectId}
              onChange={(id) => setF({ ...f, projectId: id })}
              placeholder="เว้นว่าง = ค่าใช้จ่ายทั่วไป"
            />
          </div>
        </div>

        <div className="form-row">
          <label>รายละเอียด</label>
          <input value={f.description} onChange={set("description")} placeholder="เช่น ค่าปูนซีเมนต์ 50 ถุง" />
        </div>

        <FormDivider>มูลค่าและภาษี</FormDivider>
        <div className="form-grid-3">
          <div className="form-row">
            <label>มูลค่าก่อนภาษี (บาท)</label>
            <input type="number" min="0" step="0.01" value={f.amount} onChange={set("amount")} required />
          </div>
          <div className="form-row">
            <label className="vat-toggle">
              <input type="checkbox" checked={f.vat} onChange={(e) => setF({ ...f, vat: e.target.checked })} />
              มีภาษีมูลค่าเพิ่ม 7% (นับเป็นภาษีซื้อ)
            </label>
          </div>
          <div className="form-row">
            <label className="vat-toggle">
              <input type="checkbox" checked={f.whtApplicable} onChange={(e) => setF({ ...f, whtApplicable: e.target.checked })} />
              ต้องหัก ณ ที่จ่าย
            </label>
          </div>
        </div>

        {f.whtApplicable && (
          <>
            <div className="form-grid-2">
              <div className="form-row">
                <label>อัตราหัก ณ ที่จ่าย</label>
                <select value={f.whtRate} onChange={(e) => setF({ ...f, whtRate: Number(e.target.value) })}>
                  {WHT_RATES.map((r) => <option key={r.rate} value={r.rate}>{r.label}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label>ประเภทเงินได้พึงประเมิน (ตามแบบ 50 ทวิ)</label>
                <select value={f.whtIncomeRow} onChange={set("whtIncomeRow")}>
                  {WHT_INCOME_TYPES.map((t) => <option key={t.row} value={t.row}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <p className="field-hint">อัตรานี้เป็นค่าที่พบบ่อย ควรตรวจสอบกับนักบัญชีก่อนใช้งานจริง</p>

            <FormDivider>สำหรับพิมพ์หนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ — ตามแบบกรมสรรพากร)</FormDivider>
            <div className="form-grid-3">
              <div className="form-row">
                <label>เล่มที่ (ไม่บังคับ)</label>
                <input value={f.bookNo} onChange={set("bookNo")} className="mono-input" />
              </div>
              <div className="form-row">
                <label>เลขที่หนังสือรับรอง</label>
                <input value={f.whtCertNo} onChange={set("whtCertNo")} className="mono-input" />
              </div>
              <div className="form-row">
                <label>ยื่นตามแบบ</label>
                <select value={f.pndType} onChange={set("pndType")}>
                  {WHT_PND_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="form-grid-3">
              <div className="form-row">
                <label>ลักษณะการหัก (ผู้จ่ายเงิน)</label>
                <select value={f.issueType} onChange={set("issueType")}>
                  {WHT_ISSUE_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label>ผู้ลงนาม (ผู้จ่ายเงิน)</label>
                <select value={f.signerId} onChange={set("signerId")}>
                  <option value="">— ไม่ระบุ —</option>
                  {data.signers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="check-item" style={{ marginTop: 22 }}>
                  <input
                    type="checkbox"
                    checked={f.showSignature}
                    onChange={(e) => setF({ ...f, showSignature: e.target.checked })}
                    disabled={!data.signers.find((s) => s.id === f.signerId)?.signatureImage}
                  />
                  แสดงรูปลายเซ็นจริง
                </label>
              </div>
            </div>
          </>
        )}

        <div className="totals-box">
          <div><span>มูลค่าก่อนภาษี</span><span className="mono-amt">฿{baht(t.base)}</span></div>
          {f.vat && <div><span>ภาษีมูลค่าเพิ่ม 7% (ภาษีซื้อ)</span><span className="mono-amt">฿{baht(t.vatAmount)}</span></div>}
          <div><span>รวมเป็นเงิน</span><span className="mono-amt">฿{baht(t.totalWithVat)}</span></div>
          {f.whtApplicable && <div><span>หัก ณ ที่จ่าย ({f.whtRate}%)</span><span className="mono-amt">-฿{baht(t.whtAmount)}</span></div>}
          <div className="totals-final"><span>ยอดสุทธิที่ต้องจ่ายจริง</span><span className="mono-amt-lg">฿{baht(t.netPaid)}</span></div>
        </div>

        <div className="form-row">
          <label>หมายเหตุ</label>
          <textarea rows={2} value={f.note} onChange={set("note")} />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="btn btn-primary">บันทึกรายจ่าย</button>
        </div>
      </form>
    </Modal>
  );
}
