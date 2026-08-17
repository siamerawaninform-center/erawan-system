import { TitleBlock, EmptyState, Stamp, Kpi, projectStatusVariant, finStatusVariant } from "../components/UI.jsx";
import { baht, computeFinTotal, formatShortThaiDate } from "../lib/format.js";

/* ---------------------------------------------------------
   01 ภาพรวม — สถานะการทำงาน ณ ปัจจุบัน
   หลักการ: "ดูปุ๊บรู้ปั๊บ" ไม่ใส่การวิเคราะห์เชิงลึก
   (การวิเคราะห์อยู่ในเมนู "วิเคราะห์การเงิน" แยกต่างหาก)
--------------------------------------------------------- */

export default function Dashboard({ data, setView }) {
  const { projects, quotes } = data;

  const active = projects.filter((p) => p.status === "กำลังดำเนินการ");
  const totalBudget = projects.reduce((s, p) => s + (Number(p.budget) || 0), 0);

  // ใบเสนอราคาที่ยังติดตามผลอยู่ (ยังไม่อนุมัติ/ยังไม่ยกเลิก)
  const pendingQuotes = quotes.filter(
    (q) => q.type === "ใบเสนอราคา" && !["อนุมัติแล้ว", "ยกเลิก", "ชำระแล้ว"].includes(q.status)
  );

  // ยอดค้างรับจากเอกสารเรียกเก็บที่ยังไม่ได้เงิน
  const outstanding = quotes
    .filter((q) => ["ใบวางบิล", "ใบแจ้งหนี้", "ใบกำกับภาษี"].includes(q.type)
      && !["ชำระแล้ว", "ยกเลิก"].includes(q.status))
    .reduce((s, q) => s + computeFinTotal(q.items, q.vat, q.discount).total, 0);

  const recentProjects = [...projects]
    .sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""))
    .slice(0, 5);

  return (
    <div className="view">
      <TitleBlock eyebrow="01 — ภาพรวมระบบ" title="แดชบอร์ด" sheetNo="1/1" />

      <div className="kpi-grid">
        <Kpi label="โปรเจกต์ทั้งหมด" value={projects.length} />
        <Kpi label="กำลังดำเนินการ" value={active.length} />
        <Kpi label="มูลค่าโปรเจกต์รวม" value={`฿${baht(totalBudget)}`} />
        <Kpi label="ยอดค้างรับ" value={`฿${baht(outstanding)}`} tone="warn" />
      </div>

      <div className="split">
        <div className="panel">
          <div className="panel-head">
            <h3>โปรเจกต์ล่าสุด</h3>
            <button className="link-btn" onClick={() => setView("projects")}>ดูทั้งหมด →</button>
          </div>
          {recentProjects.length === 0 ? (
            <EmptyState title="ยังไม่มีโปรเจกต์" body="เริ่มบันทึกโปรเจกต์แรกได้ที่เมนูโปรเจกต์" />
          ) : (
            <div className="mini-list">
              {recentProjects.map((p) => (
                <div key={p.id} className="mini-row">
                  <div className="mini-row-main">
                    <span className="mono-code">{p.code}</span>
                    <span>{p.name}</span>
                  </div>
                  <Stamp label={p.status} variant={projectStatusVariant(p.status)} />
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${p.progress || 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>ใบเสนอราคาที่ยังติดตามผล</h3>
            <button className="link-btn" onClick={() => setView("finance")}>ดูทั้งหมด →</button>
          </div>
          {pendingQuotes.length === 0 ? (
            <EmptyState
              title="ยังไม่มีใบเสนอราคาที่รอผล"
              body="ใบเสนอราคาที่ยังไม่ได้รับคำตอบจากลูกค้าจะแสดงที่นี่"
            />
          ) : (
            <div className="mini-list">
              {pendingQuotes.slice(0, 6).map((q) => {
                const t = computeFinTotal(q.items, q.vat, q.discount);
                return (
                  <div key={q.id} className="mini-row">
                    <div className="mini-row-main">
                      <span className="mono-code">{q.code}</span>
                      <span>{q.customerName || "—"}</span>
                      <span className="mini-meta">ยื่นเมื่อ {formatShortThaiDate(q.date)}</span>
                    </div>
                    <Stamp label={q.status} variant={finStatusVariant(q.status)} />
                    <span className="mono-amt">฿{baht(t.total)}</span>
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
