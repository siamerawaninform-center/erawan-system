import { useEffect } from "react";
import logoUrl from "../assets/logo.png";
import { formatShortThaiDate, todayISO } from "../lib/format.js";

/* ---------------------------------------------------------
   ส่วนประกอบ UI ที่ใช้ซ้ำทั้งระบบ
--------------------------------------------------------- */

/** โลโก้บริษัท — เปลี่ยนไฟล์ที่ src/assets/logo.png ได้เลย */
export function Logo({ size = 34, boxed = false }) {
  const img = (
    <img
      src={logoUrl}
      alt="โลโก้ บริษัท สยาม เอราวัณ คอนสตรัคชั่น จำกัด"
      width={size}
      height={size}
      style={{ objectFit: "contain", display: "block" }}
    />
  );
  if (!boxed) return img;
  return <span className="logo-box">{img}</span>;
}

/** ป้ายสถานะทรงตราประทับ */
export function Stamp({ label, variant = "steel" }) {
  return <span className={`stamp stamp-${variant}`}>{label}</span>;
}

export function projectStatusVariant(status) {
  switch (status) {
    case "กำลังดำเนินการ": return "maroon";
    case "เสร็จสิ้น": return "ok";
    case "ระงับ": return "warn";
    default: return "steel";
  }
}

export function finStatusVariant(status) {
  switch (status) {
    case "ส่งแล้ว": return "maroon";
    case "อนุมัติแล้ว": return "ink";
    case "ชำระแล้ว": return "ok";
    case "เกินกำหนดชำระ": return "warn";
    default: return "steel";
  }
}

export function billingStatusVariant(status) {
  switch (status) {
    case "วางบิลสำเร็จ": return "ok";
    case "ตรวจงานไม่ผ่าน":
    case "บิลหาย ต้องออกใหม่": return "warn";
    case "ลูกค้าเลื่อนวันวาง": return "maroon";
    default: return "steel";
  }
}

/** สถานะว่างเปล่า */
export function EmptyState({ title, body, actionLabel, onAction }) {
  return (
    <div className="empty">
      <div className="empty-mark">＋</div>
      <h3>{title}</h3>
      {body && <p>{body}</p>}
      {actionLabel && (
        <button className="btn btn-primary" onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  );
}

/** แถบหัวหน้าจอสไตล์ title block ของแบบก่อสร้าง */
export function TitleBlock({ eyebrow, title, sheetNo, note }) {
  return (
    <div className="titleblock">
      <div className="tb-cell tb-main">
        <span className="tb-eyebrow">{eyebrow}</span>
        <span className="tb-title">{title}</span>
      </div>
      <div className="tb-cell">
        <span className="tb-label">บริษัท</span>
        <span className="tb-value">SIAM ERAWAN</span>
      </div>
      <div className="tb-cell">
        <span className="tb-label">วันที่</span>
        <span className="tb-value">{formatShortThaiDate(todayISO())}</span>
      </div>
      <div className="tb-cell tb-last">
        <span className="tb-label">รายการ</span>
        <span className="tb-value">{sheetNo}</span>
      </div>
      {note && <div className="tb-note">{note}</div>}
    </div>
  );
}

/** กล่อง modal */
export function Modal({ title, onClose, children, wide, xwide }) {
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`modal ${wide ? "modal-wide" : ""} ${xwide ? "modal-xwide" : ""}`}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="ปิด">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/** แถบเครื่องมือค้นหา + ปุ่มหลัก */
export function Toolbar({ children }) {
  return <div className="toolbar">{children}</div>;
}

/** ตัวเลือกแบบ chip */
export function ChipRow({ options, value, onChange, allLabel = "ทั้งหมด", scroll }) {
  return (
    <div className={`chip-row ${scroll ? "chip-row-scroll" : ""}`}>
      <button
        className={`chip ${value === allLabel ? "chip-active" : ""}`}
        onClick={() => onChange(allLabel)}
      >
        {allLabel}
      </button>
      {options.map((o) => (
        <button
          key={o}
          className={`chip ${value === o ? "chip-active" : ""}`}
          onClick={() => onChange(o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/** การ์ด KPI */
export function Kpi({ label, value, tone }) {
  return (
    <div className={`kpi ${tone ? `kpi-${tone}` : ""}`}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
    </div>
  );
}

/** เส้นคั่นในฟอร์ม พร้อมคำอธิบาย */
export function FormDivider({ children }) {
  return <div className="form-divider">{children}</div>;
}
