import { useState } from "react";
import "./App.css";
import { useAppData } from "./lib/useAppData.js";
import { Logo } from "./components/UI.jsx";
import PrintDoc from "./components/PrintDoc.jsx";
import PrintBOQ from "./components/PrintBOQ.jsx";
import PrintPlan from "./components/PrintPlan.jsx";
import PrintJSA from "./components/PrintJSA.jsx";

import Dashboard from "./views/Dashboard.jsx";
import Projects from "./views/Projects.jsx";
import Documents from "./views/Documents.jsx";
import Finance from "./views/Finance.jsx";
import BOQ from "./views/BOQ.jsx";
import Plan from "./views/Plan.jsx";
import JSA from "./views/JSA.jsx";
import Expenses from "./views/Expenses.jsx";
import MonthlyArchive from "./views/MonthlyArchive.jsx";
import Debts from "./views/Debts.jsx";
import Analysis from "./views/Analysis.jsx";
import Team from "./views/Team.jsx";
import Company from "./views/Company.jsx";
import Customers from "./views/Customers.jsx";
import Suppliers from "./views/Suppliers.jsx";
import Signers from "./views/Signers.jsx";

/* ---------------------------------------------------------
   SIAM ERAWAN CONSTRUCTION — ระบบภายใน (เฟส 1-2)
--------------------------------------------------------- */

const NAV = [
  { key: "dashboard", label: "ภาพรวม", eyebrow: "01" },
  { key: "projects", label: "โปรเจกต์", eyebrow: "02" },
  { key: "documents", label: "เอกสารโครงการ", eyebrow: "03" },
  { key: "finance", label: "เอกสารบัญชี", eyebrow: "04" },
  { key: "team", label: "ทีมงาน", eyebrow: "05" },
  { key: "company", label: "ตั้งค่าบริษัท", eyebrow: "06" },
];

const NAV_REGISTRY = [
  { key: "customers", label: "ลูกค้า", eyebrow: "07" },
  { key: "suppliers", label: "ซัพพลายเออร์", eyebrow: "08" },
  { key: "signers", label: "ผู้ลงนาม", eyebrow: "09" },
];

const NAV_PROJECT_DOCS = [
  { key: "boq", label: "BOQ (ประมาณราคา)", eyebrow: "10" },
  { key: "plan", label: "แผนงาน (Timeline)", eyebrow: "11" },
  { key: "jsa", label: "JSA (ความปลอดภัย)", eyebrow: "12" },
];

const NAV_ACCOUNTING = [
  { key: "expenses", label: "รายจ่าย/ภาษีซื้อ", eyebrow: "13" },
  { key: "monthly", label: "คลังเอกสารรายเดือน", eyebrow: "14" },
  { key: "debts", label: "ทะเบียนหนี้สิน", eyebrow: "15" },
  { key: "analysis", label: "วิเคราะห์การเงิน", eyebrow: "16" },
];

export default function App() {
  const {
    data, loaded, syncState, toast,
    upsert, remove, removeProject, saveCompany,
    exportData, importData,
  } = useAppData();

  const [view, setView] = useState("dashboard");
  const [navOpen, setNavOpen] = useState(false);
  const [printJob, setPrintJob] = useState(null); // { kind: 'finance'|'boq'|'plan'|'jsa', payload }

  if (!loaded) {
    return (
      <div className="boot">
        <Logo size={48} />
        <p>กำลังโหลดระบบ…</p>
      </div>
    );
  }

  const viewProps = { data, upsert, remove, removeProject, setView };
  const closePrint = () => setPrintJob(null);

  return (
    <div className="app">
      <aside className={`sidebar ${navOpen ? "open" : ""}`}>
        <div className="brand">
          <Logo boxed />
          <div className="brand-text">
            <span className="brand-en">SIAM ERAWAN</span>
            <span className="brand-th">บริษัท สยาม เอราวัณ คอนสตรัคชั่น จำกัด</span>
          </div>
        </div>

        <nav>
          {NAV.map((n) => (
            <button
              key={n.key}
              className={`nav-item ${view === n.key ? "active" : ""}`}
              onClick={() => { setView(n.key); setNavOpen(false); }}
            >
              <span className="nav-eyebrow">{n.eyebrow}</span>
              {n.label}
            </button>
          ))}

          <div className="nav-group-label">ทะเบียนข้อมูลกลาง</div>
          {NAV_REGISTRY.map((n) => (
            <button
              key={n.key}
              className={`nav-item ${view === n.key ? "active" : ""}`}
              onClick={() => { setView(n.key); setNavOpen(false); }}
            >
              <span className="nav-eyebrow">{n.eyebrow}</span>
              {n.label}
            </button>
          ))}

          <div className="nav-group-label">เอกสารโครงการเสริม</div>
          {NAV_PROJECT_DOCS.map((n) => (
            <button
              key={n.key}
              className={`nav-item ${view === n.key ? "active" : ""}`}
              onClick={() => { setView(n.key); setNavOpen(false); }}
            >
              <span className="nav-eyebrow">{n.eyebrow}</span>
              {n.label}
            </button>
          ))}

          <div className="nav-group-label">บัญชีและภาษี</div>
          {NAV_ACCOUNTING.map((n) => (
            <button
              key={n.key}
              className={`nav-item ${view === n.key ? "active" : ""}`}
              onClick={() => { setView(n.key); setNavOpen(false); }}
            >
              <span className="nav-eyebrow">{n.eyebrow}</span>
              {n.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-tools">
          <button className="side-link" onClick={exportData}>⬇ สำรองข้อมูล (JSON)</button>
          <label className="side-link" style={{ cursor: "pointer" }}>
            ⬆ นำเข้าข้อมูลสำรอง
            <input type="file" accept="application/json" onChange={importData} hidden />
          </label>
        </div>
        <div className="sidebar-foot">
          <span className={`dot ${syncState === "error" ? "dot-warn" : ""}`} />
          <span>
            {syncState === "live" && "เชื่อมต่อฐานข้อมูลกลาง — ทุกคนเห็นข้อมูลเดียวกัน"}
            {syncState === "connecting" && "กำลังเชื่อมต่อฐานข้อมูลกลาง…"}
            {syncState === "local" && "โหมดเก็บในเบราว์เซอร์นี้เท่านั้น"}
            {syncState === "error" && "เชื่อมต่อไม่สำเร็จ — ใช้งานแบบออฟไลน์"}
          </span>
        </div>
      </aside>

      <button className="mobile-toggle" onClick={() => setNavOpen((v) => !v)} aria-label="เมนู">
        ☰ เมนู
      </button>

      <main className="main">
        {view === "dashboard" && <Dashboard {...viewProps} />}
        {view === "projects" && <Projects {...viewProps} />}
        {view === "documents" && <Documents {...viewProps} />}
        {view === "finance" && (
          <Finance {...viewProps} onPrint={(payload) => setPrintJob({ kind: "finance", payload })} />
        )}
        {view === "boq" && (
          <BOQ {...viewProps} onPrint={(boq) => setPrintJob({ kind: "boq", payload: boq })} />
        )}
        {view === "plan" && (
          <Plan {...viewProps} onPrint={(plan) => setPrintJob({ kind: "plan", payload: plan })} />
        )}
        {view === "jsa" && (
          <JSA {...viewProps} onPrint={(jsa) => setPrintJob({ kind: "jsa", payload: jsa })} />
        )}
        {view === "expenses" && <Expenses {...viewProps} />}
        {view === "monthly" && <MonthlyArchive data={data} />}
        {view === "debts" && <Debts {...viewProps} />}
        {view === "analysis" && <Analysis data={data} />}
        {view === "team" && <Team {...viewProps} />}
        {view === "company" && <Company company={data.company} onSave={saveCompany} />}
        {view === "customers" && <Customers {...viewProps} />}
        {view === "suppliers" && <Suppliers {...viewProps} />}
        {view === "signers" && <Signers {...viewProps} />}
      </main>

      {printJob?.kind === "finance" && (
        <PrintDoc payload={printJob.payload} data={data} onClose={closePrint} />
      )}
      {printJob?.kind === "boq" && (
        <PrintBOQ boq={printJob.payload} data={data} onClose={closePrint} />
      )}
      {printJob?.kind === "plan" && (
        <PrintPlan plan={printJob.payload} data={data} onClose={closePrint} />
      )}
      {printJob?.kind === "jsa" && (
        <PrintJSA jsa={printJob.payload} data={data} onClose={closePrint} />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
