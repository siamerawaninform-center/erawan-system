import { TitleBlock, Kpi } from "../components/UI.jsx";
import { baht, computeFinTotal, computeExpenseTotal, monthKey, formatThaiMonthYear } from "../lib/format.js";

/* ---------------------------------------------------------
   16 วิเคราะห์การเงิน
   1) กำไรขั้นต้นต่อโปรเจกต์  2) งบประมาณ vs ใช้จ่ายจริง  3) กระแสเงินสดรายเดือน
   คำนวณจากข้อมูลที่มีอยู่แล้วในระบบทั้งหมด ไม่มีการกรอกซ้ำ
--------------------------------------------------------- */

export default function Analysis({ data }) {
  const salesDocs = (data.quotes || []).filter((q) => q.kind === "salesSet" && q.status !== "ยกเลิก");
  const expenses = data.expenses || [];

  /* ---------- 1+2) ต่อโปรเจกต์: รายรับ / รายจ่าย / กำไรขั้นต้น / งบประมาณ ---------- */
  const perProject = data.projects.map((p) => {
    const revenue = salesDocs
      .filter((q) => q.projectId === p.id)
      .reduce((s, q) => s + computeFinTotal(q.items, q.vat, q.discount).total, 0);
    const cost = expenses
      .filter((e) => e.projectId === p.id)
      .reduce((s, e) => s + computeExpenseTotal(e.amount, e.vat, e.whtApplicable, e.whtRate).totalWithVat, 0);
    const grossProfit = revenue - cost;
    const marginPct = revenue > 0 ? (grossProfit / revenue) * 100 : null;
    const budget = Number(p.budget) || 0;
    const overBudget = budget > 0 && cost > budget;
    return { project: p, revenue, cost, grossProfit, marginPct, budget, overBudget };
  }).filter((row) => row.revenue > 0 || row.cost > 0 || row.budget > 0);

  /* ---------- 3) กระแสเงินสดรายเดือน ---------- */
  const monthMap = {};
  salesDocs.forEach((q) => {
    const key = monthKey(q.date);
    if (!key) return;
    monthMap[key] = monthMap[key] || { revenue: 0, cost: 0 };
    monthMap[key].revenue += computeFinTotal(q.items, q.vat, q.discount).total;
  });
  expenses.forEach((e) => {
    const key = monthKey(e.date);
    if (!key) return;
    monthMap[key] = monthMap[key] || { revenue: 0, cost: 0 };
    monthMap[key].cost += computeExpenseTotal(e.amount, e.vat, e.whtApplicable, e.whtRate).totalWithVat;
  });
  const months = Object.keys(monthMap).sort().slice(-12); // ล่าสุด 12 เดือนที่มีข้อมูล
  const maxVal = Math.max(1, ...months.map((k) => Math.max(monthMap[k].revenue, monthMap[k].cost)));

  const totalRevenue = perProject.reduce((s, r) => s + r.revenue, 0);
  const totalCost = perProject.reduce((s, r) => s + r.cost, 0);

  return (
    <div className="view">
      <TitleBlock
        eyebrow="16 — วิเคราะห์การเงิน"
        title="วิเคราะห์การเงิน"
        sheetNo={`${perProject.length} โปรเจกต์`}
        note="คำนวณจากเอกสารขายและรายจ่ายที่มีอยู่แล้วในระบบ อัปเดตอัตโนมัติทุกครั้งที่เข้าหน้านี้"
      />

      <div className="kpi-grid">
        <Kpi label="รายรับรวมทุกโปรเจกต์" value={`฿${baht(totalRevenue)}`} />
        <Kpi label="ต้นทุน/รายจ่ายรวม" value={`฿${baht(totalCost)}`} />
        <Kpi label="กำไรขั้นต้นรวม" value={`฿${baht(totalRevenue - totalCost)}`} />
        <Kpi label="โปรเจกต์เกินงบ" value={`${perProject.filter((r) => r.overBudget).length} โปรเจกต์`} />
      </div>

      <div className="panel">
        <div className="panel-head"><h3>กำไรขั้นต้นต่อโปรเจกต์ (รายรับ − รายจ่ายที่ผูกกับโปรเจกต์)</h3></div>
        {perProject.length === 0 ? (
          <p className="muted">ยังไม่มีข้อมูลรายรับหรือรายจ่ายที่ผูกกับโปรเจกต์เพียงพอสำหรับวิเคราะห์</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>โปรเจกต์</th><th>รายรับ</th><th>รายจ่าย</th><th>กำไรขั้นต้น</th><th>% กำไร</th>
                </tr>
              </thead>
              <tbody>
                {perProject.map((row) => (
                  <tr key={row.project.id}>
                    <td>{row.project.code} — {row.project.name}</td>
                    <td className="mono-amt">{baht(row.revenue)}</td>
                    <td className="mono-amt">{baht(row.cost)}</td>
                    <td className={`mono-amt ${row.grossProfit < 0 ? "amt-negative" : ""}`}>{baht(row.grossProfit)}</td>
                    <td className="mono-amt">{row.marginPct === null ? "—" : `${row.marginPct.toFixed(1)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head"><h3>งบประมาณ vs ใช้จ่ายจริง</h3></div>
        {perProject.filter((r) => r.budget > 0).length === 0 ? (
          <p className="muted">ยังไม่มีโปรเจกต์ที่ตั้งงบประมาณไว้ (กรอกได้ที่หน้า "02 โปรเจกต์")</p>
        ) : (
          <div className="budget-list">
            {perProject.filter((r) => r.budget > 0).map((row) => {
              const pct = Math.min(100, (row.cost / row.budget) * 100);
              return (
                <div className="budget-row" key={row.project.id}>
                  <div className="budget-row-head">
                    <span>{row.project.code} — {row.project.name}</span>
                    <span className={row.overBudget ? "amt-negative" : ""}>
                      ฿{baht(row.cost)} / ฿{baht(row.budget)} {row.overBudget && "⚠ เกินงบ"}
                    </span>
                  </div>
                  <div className="progress-track">
                    <div
                      className={`progress-fill ${row.overBudget ? "progress-fill-warn" : ""}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head"><h3>กระแสเงินสดรายเดือน (12 เดือนล่าสุดที่มีข้อมูล)</h3></div>
        {months.length === 0 ? (
          <p className="muted">ยังไม่มีข้อมูลรายรับ/รายจ่ายเพียงพอสำหรับดูแนวโน้มรายเดือน</p>
        ) : (
          <div className="cashflow-chart">
            {months.map((k) => {
              const m = monthMap[k];
              const net = m.revenue - m.cost;
              return (
                <div className="cashflow-row" key={k}>
                  <div className="cashflow-label">{formatThaiMonthYear(k)}</div>
                  <div className="cashflow-bars">
                    <div className="cashflow-bar-wrap">
                      <div className="cashflow-bar cashflow-bar-rev" style={{ width: `${(m.revenue / maxVal) * 100}%` }} />
                      <span className="cashflow-val">฿{baht(m.revenue)}</span>
                    </div>
                    <div className="cashflow-bar-wrap">
                      <div className="cashflow-bar cashflow-bar-cost" style={{ width: `${(m.cost / maxVal) * 100}%` }} />
                      <span className="cashflow-val">฿{baht(m.cost)}</span>
                    </div>
                  </div>
                  <div className={`cashflow-net ${net < 0 ? "amt-negative" : ""}`}>สุทธิ ฿{baht(net)}</div>
                </div>
              );
            })}
            <div className="cashflow-legend">
              <span><i className="dot-rev" /> รายรับ</span>
              <span><i className="dot-cost" /> รายจ่าย</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
