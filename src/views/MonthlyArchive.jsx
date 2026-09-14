import { useState } from "react";
import { TitleBlock, Toolbar, Stamp, Kpi, finStatusVariant } from "../components/UI.jsx";
import { baht, formatShortThaiDate, computeFinTotal, computeExpenseTotal, monthKey, formatThaiMonthYear } from "../lib/format.js";
import { buildDocCode, salesSetDocCode } from "../lib/docNumber.js";
import { SALES_SET_TYPES, THAI_MONTHS_FULL } from "../lib/constants.js";
import { openMonthlyPackagePrint } from "../components/PrintMonthlyPackage.jsx";

/* ---------------------------------------------------------
   14 คลังเอกสารรายเดือน — สรุปยอดและรวมเอกสารส่งบัญชีรายเดือน
   จัดกลุ่มอัตโนมัติจากวันที่บนเอกสาร ไม่ต้องมีใครลากไฟล์ย้ายเอง
--------------------------------------------------------- */

export default function MonthlyArchive({ data }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const ym = `${year}-${String(month).padStart(2, "0")}`;

  const customer = (id) => data.customers.find((c) => c.id === id);
  const supplier = (id) => data.suppliers.find((s) => s.id === id);

  // รายการเอกสารขายของเดือนนี้ (ตามวันที่วางบิล) — ใช้แสดงในหน้าคลังเอกสารเฉยๆ
  const salesDocs = (data.quotes || [])
    .filter((q) => q.kind === "salesSet" && monthKey(q.date) === ym && q.status !== "ยกเลิก")
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  // เอกสารที่ "ออกใบกำกับภาษี/ใบเสร็จจริง" แล้วในเดือนนี้ (ตามวันที่รับชำระ ไม่ใช่วันที่วางบิล)
  // ใช้เฉพาะตอนพิมพ์แพ็คเกจส่งบัญชี/รายงานภาษีขาย กันเอกสารที่ยังไม่ออกจริงหลุดเข้ารายงาน
  const taxInvoiceDocs = (data.quotes || [])
    .filter((q) => q.kind === "salesSet" && q.status === "ชำระแล้ว" && q.taxInvoiceDate && monthKey(q.taxInvoiceDate) === ym)
    .sort((a, b) => (a.taxInvoiceDate || "").localeCompare(b.taxInvoiceDate || ""));

  const expenses = (data.expenses || [])
    .filter((e) => monthKey(e.date) === ym)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  // ใช้ taxInvoiceDocs (ออกใบกำกับภาษีจริงแล้ว) คำนวณยอด/ภาษีขาย — ให้ตรงกับรายงานภาษีขายที่พิมพ์จริง
  const salesTotals = taxInvoiceDocs.reduce(
    (acc, q) => {
      const t = computeFinTotal(q.items, q.vat, q.discount);
      acc.total += t.total;
      acc.vat += t.vatAmount;
      return acc;
    },
    { total: 0, vat: 0 }
  );

  const expenseTotals = expenses.reduce(
    (acc, e) => {
      const t = computeExpenseTotal(e.amount, e.vat, e.whtApplicable, e.whtRate);
      acc.total += t.totalWithVat;
      acc.vat += t.vatAmount;
      acc.wht += t.whtAmount;
      return acc;
    },
    { total: 0, vat: 0, wht: 0 }
  );

  const netVatDue = salesTotals.vat - expenseTotals.vat;

  // ตัวเลือกปี — เอาจากข้อมูลที่มีอยู่จริง รวมปีปัจจุบันด้วยเสมอ
  const yearsFromData = new Set([now.getFullYear()]);
  [...(data.quotes || []), ...(data.expenses || [])].forEach((r) => {
    if (r.date) yearsFromData.add(Number(r.date.slice(0, 4)));
  });
  const years = [...yearsFromData].sort((a, b) => b - a);

  const handlePrint = () => {
    // ส่งเฉพาะเอกสารที่ออกใบกำกับภาษีจริงแล้วเข้ารายงานภาษีขาย — ไม่ใช่ทุกเอกสารที่ถูกวางบิลในเดือนนี้
    openMonthlyPackagePrint({ ym, year, month, salesDocs: taxInvoiceDocs, expenses, data, customer, supplier });
  };

  return (
    <div className="view">
      <TitleBlock
        eyebrow="15 — สรุปรายเดือน"
        title="คลังเอกสารรายเดือน"
        sheetNo={formatThaiMonthYear(ym)}
        note="จัดกลุ่มอัตโนมัติจากวันที่บนเอกสาร — ใช้สรุปและพิมพ์ส่งให้นักบัญชีตอนสิ้นเดือน"
      />

      <Toolbar>
        <div className="month-picker">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y + 543}</option>)}
          </select>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {THAI_MONTHS_FULL.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={handlePrint}>
          🖶 พิมพ์แพ็คเกจส่งบัญชี
        </button>
      </Toolbar>

      <div className="kpi-grid">
        <Kpi label="รายรับรวม (ใบกำกับภาษีที่ออกแล้ว)" value={`฿${baht(salesTotals.total)}`} />
        <Kpi label="ภาษีขาย" value={`฿${baht(salesTotals.vat)}`} />
        <Kpi label="รายจ่ายรวม" value={`฿${baht(expenseTotals.total)}`} />
        <Kpi label="ภาษีซื้อ" value={`฿${baht(expenseTotals.vat)}`} />
      </div>
      <div className="kpi-grid kpi-grid-3">
        <div className={`kpi ${netVatDue >= 0 ? "kpi-warn" : ""}`}>
          <span className="kpi-label">{netVatDue >= 0 ? "ภาษีมูลค่าเพิ่มที่ต้องนำส่ง" : "ภาษีมูลค่าเพิ่มที่ขอคืนได้"}</span>
          <span className="kpi-value">฿{baht(Math.abs(netVatDue))}</span>
        </div>
        <Kpi label="ยอดหัก ณ ที่จ่ายรวม" value={`฿${baht(expenseTotals.wht)}`} />
        <Kpi label="จำนวนเอกสารเดือนนี้" value={`${salesDocs.length + expenses.length} รายการ`} />
      </div>

      <div className="split">
        <div className="panel">
          <div className="panel-head"><h3>เอกสารขายเดือนนี้ ({salesDocs.length})</h3></div>
          {salesDocs.length === 0 ? (
            <p className="muted">ไม่มีเอกสารขายในเดือนนี้</p>
          ) : (
            <div className="mini-list">
              {salesDocs.map((q) => {
                const t = computeFinTotal(q.items, q.vat, q.discount);
                const taxCode = salesSetDocCode(q, "ใบกำกับภาษี") || "—";
                return (
                  <div key={q.id} className="mini-row">
                    <div className="mini-row-main">
                      <span className="mono-code">{taxCode}</span>
                      <span>{customer(q.customerId)?.nameTh || q.customerName || "—"}</span>
                    </div>
                    <Stamp label={q.status} variant={finStatusVariant(q.status)} />
                    <span className="mono-amt">฿{baht(t.total)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-head"><h3>รายจ่ายเดือนนี้ ({expenses.length})</h3></div>
          {expenses.length === 0 ? (
            <p className="muted">ไม่มีรายจ่ายในเดือนนี้</p>
          ) : (
            <div className="mini-list">
              {expenses.map((e) => {
                const t = computeExpenseTotal(e.amount, e.vat, e.whtApplicable, e.whtRate);
                const vendorText = e.vendorId ? supplier(e.vendorId)?.nameTh : e.vendorName;
                return (
                  <div key={e.id} className="mini-row">
                    <div className="mini-row-main">
                      <span className="mono-code">{e.code}</span>
                      <span>{vendorText || "—"}</span>
                    </div>
                    <span className="muted">{e.category}</span>
                    <span className="mono-amt">฿{baht(t.totalWithVat)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
