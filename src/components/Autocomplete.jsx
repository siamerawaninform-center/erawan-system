import { useState, useRef, useEffect } from "react";

/* ---------------------------------------------------------
   ช่องพิมพ์ค้นหาแบบเลือกได้ (แทน <select> ยาวๆ)
   พิมพ์คำใกล้เคียงแล้วขึ้นลิสต์ผลลัพธ์ให้เลือก เหมาะกับข้อมูลเยอะ
   เช่น ทะเบียนลูกค้า/โปรเจกต์ ที่จะเพิ่มขึ้นเรื่อยๆ ในอนาคต
--------------------------------------------------------- */

export function Autocomplete({
  options,           // [{ id, label, sublabel }]
  value,              // id ที่เลือกอยู่ (หรือ "")
  onChange,           // (id) => void
  placeholder = "พิมพ์เพื่อค้นหา…",
  allowClear = true,
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const boxRef = useRef(null);

  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => `${o.label} ${o.sublabel || ""}`.toLowerCase().includes(q))
    : options;

  const displayValue = open ? query : selected ? selected.label : "";

  const pick = (opt) => {
    onChange(opt.id);
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (filtered[activeIdx]) pick(filtered[activeIdx]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  return (
    <div className="ac-wrap" ref={boxRef}>
      <input
        value={displayValue}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActiveIdx(0); }}
        onFocus={() => { setQuery(""); setOpen(true); setActiveIdx(0); }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="ac-input"
        autoComplete="off"
      />
      {selected && !open && allowClear && (
        <button type="button" className="ac-clear" onClick={() => onChange("")} aria-label="ล้างค่า">✕</button>
      )}
      {open && (
        <div className="ac-menu">
          {filtered.length === 0 ? (
            <div className="ac-empty">ไม่พบรายการที่ตรงกัน</div>
          ) : (
            filtered.slice(0, 50).map((o, i) => (
              <div
                key={o.id}
                className={`ac-option ${i === activeIdx ? "ac-option-active" : ""} ${o.id === value ? "ac-option-selected" : ""}`}
                onMouseDown={() => pick(o)}
                onMouseEnter={() => setActiveIdx(i)}
              >
                <span className="ac-option-label">{o.label}</span>
                {o.sublabel && <span className="ac-option-sub">{o.sublabel}</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
