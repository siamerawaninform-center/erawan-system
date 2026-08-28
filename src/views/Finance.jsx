import { useState } from "react";
import {
  TitleBlock, Modal, EmptyState, Toolbar, ChipRow, Stamp, FormDivider,
  finStatusVariant, billingStatusVariant,
} from "../components/UI.jsx";
import { Autocomplete } from "../components/Autocomplete.jsx";
import { uid, baht, todayISO, formatShortThaiDate, computeFinTotal, lineTotal, monthKey, formatThaiMonthYear, exportToCSV } from "../lib/format.js";
import { allocateDocNumber, buildDocCode } from "../lib/docNumber.js";
import {
  FIN_TYPES, FIN_STATUSES, BILLING_STATUSES, PAYMENT_METHODS, SALES_SET_TYPES, ISSUED_AS_OPTIONS,
} from "../lib/constants.js";

/* ---------------------------------------------------------
   04 เอกสารบัญชี
   เลขที่เอกสารทำตามรูปแบบจริงของบริษัท
   เอกสารชุดขาย 1 ชุด = พิมพ์ได้ 4 แบบ (วางบิล/แจ้งหนี้/กำกับภาษี/เสร็จรับเงิน)
   จัดกลุ่มเป็น "โฟลเดอร์" ปี→เดือน อัตโนมัติจากวันที่บนเอกสาร
--------------------------------------------------------- */

export default function Finance({ data, upsert, remove, onPrint, onPrintSet }) {
  const [modal, setModal] = useState(null);
  const [printSetModal, setPrintSetModal] = useState(null); // { record }
  const [filterType, setFilterType] = useState("ทั้งหมด");
  const [q, setQ] = useState("");
  const [collapsed, setCollapsed] = useState({});

  const customer = (id) => data.customers.find((c) => c.id === id);
  const project = (id) => data.projects.find((p) => p.id === id);

  const list = (data.quotes || [])
    .filter((f) => {
      if (filterType === "ทั้งหมด") return true;
      if (f.kind === "salesSet") return SALES_SET_TYPES.includes(filterType);
      return f.type === filterType;
    })
    .filter((f) => {
      const cname = customer(f.customerId)?.nameTh || f.customerName || "";
      return `${f.code} ${cname} ${f.refPO || ""}`.toLowerCase().includes(q.toLowerCase());
    })
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const handleExportCSV = () => {
    const headers = [
      "รหัส", "ประเภท", "วันที่", "ลูกค้า", "โปรเจกต์", "สถานะ",
      "ยอดรวม", "ส่วนลด", "VAT", "ยอดสุทธิ", "เลข PO",
    ];
    const rows = list.map((f) => {
      const t = computeFinTotal(f.items, f.vat, f.discount);
      const cname = customer(f.customerId)?.nameTh || f.customerName || "";
      const proj = project(f.projectId);
      const typeLabel = f.kind === "salesSet" ? "ชุดเรียกเก็บ" : f.type;
      return [
        f.code, typeLabel, f.date || "", cname, proj ? `${proj.code} ${proj.name}` : "",
        f.kind === "salesSet" ? (f.billingStatus || "") : (f.status || ""),
        t.subtotal.toFixed(2), t.discount.toFixed(2), t.vatAmount.toFixed(2), t.total.toFixed(2),
        f.refPO || "",
      ];
    });
    exportToCSV(`เอกสารบัญชี-${todayISO()}`, headers, rows);
  };

  // จัดกลุ่มเป็น "โฟลเดอร์" ตามเดือน — คำนวณจากวันที่บนเอกสารทุกครั้ง ไม่ต้องมีใครย้ายเอง
  const groupMap = {};
  list.forEach((f) => {
    const key = monthKey(f.date) || "ไม่ระบุวันที่";
    (groupMap[key] = groupMap[key] || []).push(f);
  });
  const monthGroups = Object.keys(groupMap)
    .sort((a, b) => b.localeCompare(a))
    .map((key) => ({ key, items: groupMap[key] }));

  const toggleGroup = (key, isNewest) =>
    setCollapsed({ ...collapsed, [key]: collapsed[key] === undefined ? isNewest : !collapsed[key] });
  const isGroupCollapsed = (key, isNewest) =>
    collapsed[key] === undefined ? !isNewest : collapsed[key];

  return (
    <div className="view">
      <TitleBlock
        eyebrow="04 — เอกสารบัญชี"
        title="ใบเสนอราคา · วางบิล · แจ้งหนี้ · กำกับภาษี · เสร็จรับเงิน"
        sheetNo={`${list.length}/${(data.quotes || []).length}`}
        note="เอกสารชุดขาย 1 ชุด ใช้เลขวิ่งเดียวกัน พิมพ์ได้ทั้ง 4 แบบโดยไม่ต้องกรอกซ้ำ"
      />

      <Toolbar>
        <input
          className="search"
          placeholder="ค้นหาเลขที่เอกสาร ชื่อลูกค้า หรือเลข PO…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="btn-group">
          <button className="btn btn-ghost" onClick={handleExportCSV}>⬇ Export CSV</button>
          <button
            className="btn btn-ghost"
            onClick={() => setModal({ mode: "add", kind: "quote" })}
            disabled={data.projects.length === 0}
          >+ ใบเสนอราคา</button>
          <button
            className="btn btn-primary"
            onClick={() => setModal({ mode: "add", kind: "salesSet" })}
            disabled={data.projects.length === 0}
          >+ ชุดเอกสารเรียกเก็บ</button>
        </div>
      </Toolbar>

      <ChipRow options={FIN_TYPES} value={filterType} onChange={setFilterType} scroll />

      {data.projects.length === 0 ? (
        <EmptyState title="ยังไม่มีโปรเจกต์ให้ออกเอกสาร" body="เพิ่มโปรเจกต์อย่างน้อย 1 รายการก่อน จึงจะออกเอกสารบัญชีได้" />
      ) : (data.quotes || []).length === 0 ? (
        <EmptyState
          title="ยังไม่มีเอกสารบัญชี"
          body="สร้างใบเสนอราคาเพื่อยื่นลูกค้า หรือสร้างชุดเอกสารเรียกเก็บเมื่อถึงงวดวางบิล"
          actionLabel="+ สร้างชุดเอกสารเรียกเก็บ"
          onAction={() => setModal({ mode: "add", kind: "salesSet" })}
        />
      ) : (
        <div className="project-groups">
          {monthGroups.map((g, idx) => {
            const isNewest = idx === 0;
            const closed = isGroupCollapsed(g.key, isNewest);
            const monthLabel = g.key === "ไม่ระบุวันที่" ? g.key : formatThaiMonthYear(g.key);
            return (
              <div className="project-group" key={g.key}>
                <button className="project-group-head" onClick={() => toggleGroup(g.key, isNewest)}>
                  <span className={`pg-arrow ${closed ? "pg-arrow-closed" : ""}`}>▾</span>
                  <span className="pg-month-label">{monthLabel}</span>
                  <span className="pg-count">{g.items.length} รายการ</span>
                </button>
                {!closed && (
                  <div className="card-grid">
                    {g.items.map((f) => {
                      const t = computeFinTotal(f.items, f.vat, f.discount);
                      const cust = customer(f.customerId);
                      const proj = project(f.projectId);
                      const isSet = f.kind === "salesSet";
                      return (
                        <div className="card" key={f.id}>
                          <div className="card-top">
                            <span className="mono-code">{f.code}</span>
                            <Stamp label={f.status} variant={finStatusVariant(f.status)} />
                          </div>
                          <h4>{isSet ? "ชุดเอกสารเรียกเก็บ" : "ใบเสนอราคา"}</h4>
                          <p className="card-sub">{cust?.nameTh || f.customerName || "—"}</p>
                          {proj && <p className="card-line">{proj.code} — {proj.name}</p>}
                          {f.refPO && <p className="card-line">PO: {f.refPO}</p>}

                          <div className="card-meta-row">
                            <span>วันที่ {formatShortThaiDate(f.date)}</span>
                            <span>ครบกำหนด {formatShortThaiDate(f.dueDate) || "—"}</span>
                          </div>

                          {isSet && (
                            <div className="set-codes">
                              {SALES_SET_TYPES.map((t2) => (
                                <span key={t2} className="set-code-chip">
                                  {t2.replace("ใบ", "")} <b>{buildDocCode(t2, f.period, f.running)}</b>
                                </span>
                              ))}
                            </div>
                          )}

                          {isSet && f.billingStatus && (
                            <div className="billing-line">
                              <span className="muted">สถานะวางบิล</span>
                              <Stamp label={f.billingStatus} variant={billingStatusVariant(f.billingStatus)} />
                            </div>
                          )}

                          <div className="amount-line">
                            <span>ยอดรวม{f.vat ? " (รวม VAT 7%)" : ""}</span>
                            <span className="mono-amt-lg">฿{baht(t.total)}</span>
                          </div>

                          <div className="card-actions card-actions-wrap">
                            <button className="btn btn-ghost btn-sm" onClick={() => setModal({ mode: "edit", item: f, kind: f.kind })}>แก้ไข</button>
                            {isSet ? (
                              <>
                                {SALES_SET_TYPES.map((t2) => (
                                  <button
                                    key={t2}
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => onPrint({ record: f, printType: t2 })}
                                  >🖶 {t2.replace("ใบ", "")}</button>
                                ))}
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => setPrintSetModal({ record: f })}
                                >🖶 พิมพ์รวมทั้งชุด (PDF เดียว)</button>
                              </>
                            ) : (
                              <button className="btn btn-ghost btn-sm" onClick={() => onPrint({ record: f, printType: "ใบเสนอราคา" })}>🖶 พิมพ์</button>
                            )}
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => { if (confirm(`ลบเอกสาร "${f.code}"?`)) remove("quotes", f.id, "เอกสาร"); }}
                            >ลบ</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <FinanceForm
          mode={modal.mode}
          kind={modal.kind}
          item={modal.item}
          data={data}
          onSave={(item) => { upsert("quotes", item, "เอกสาร"); setModal(null); }}
          onClose={() => setModal(null)}
        />
      )}

      {printSetModal && (
        <PrintSetConfigModal
          record={printSetModal.record}
          onConfirm={(counts) => { onPrintSet({ record: printSetModal.record, counts }); setPrintSetModal(null); }}
          onClose={() => setPrintSetModal(null)}
        />
      )}
    </div>
  );
}

/* ========================================================= */

function FinanceForm({ mode, kind, item, data, onSave, onClose }) {
  const isSet = kind === "salesSet";
  const defaultSigner = data.signers.find((s) => s.isDefault) || data.signers[0];

  const [f, setF] = useState(() => {
    // รายการเก่าที่สร้างไว้ก่อนมีช่องนี้ ให้ถือว่าเป็น "นามบริษัท" และ "ไม่แยกวัสดุ/แรง" เป็นค่าเริ่มต้น
    if (item) return { issuedAs: ISSUED_AS_OPTIONS[0], splitMaterialLabor: false, ...item };
    const type = isSet ? "ใบกำกับภาษี" : "ใบเสนอราคา";
    const alloc = allocateDocNumber(data.quotes, type, todayISO(), data.company);
    return {
      id: uid("fin"),
      kind: isSet ? "salesSet" : "quote",
      type,
      period: alloc.period,
      running: alloc.running,
      code: alloc.code,
      projectId: data.projects[0]?.id || "",
      customerId: data.customers[0]?.id || "",
      customerName: "",
      status: FIN_STATUSES[0],
      billingStatus: isSet ? BILLING_STATUSES[0] : undefined,
      date: todayISO(),
      dueDate: "",
      creditDays: 30,
      refPO: "",
      vat: true,
      discount: 0,
      issuedAs: ISSUED_AS_OPTIONS[0], // ค่าเริ่มต้น: นามบริษัท
      splitMaterialLabor: false, // ค่าเริ่มต้น: ราคา/หน่วยรวมเป็นก้อนเดียวเหมือนเดิม
      paymentMethod: "",
      chequeNo: "",
      signerIssuer: defaultSigner?.name || "",
      signerApprover: defaultSigner?.name || "",
      signerSales: defaultSigner?.name || "",
      showSignature: false,
      items: [{ id: uid("it"), desc: "", qty: 1, unit: "งาน", price: 0, discount: 0 }],
      paymentTerms: "",
      note: "",
    };
  });

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  /* เปลี่ยนวันที่ → คิดเลขวิ่งใหม่ (เพราะเลขผูกกับเดือน) */
  const changeDate = (e) => {
    const date = e.target.value;
    let next = { ...f, date };
    if (mode === "add") {
      const alloc = allocateDocNumber(data.quotes, f.type, date, data.company, f.issuedAs);
      next = { ...next, period: alloc.period, running: alloc.running, code: alloc.code };
    }
    // คำนวณวันครบกำหนดจากเครดิต
    if (date && f.creditDays) {
      const d = new Date(date + "T00:00:00");
      d.setDate(d.getDate() + Number(f.creditDays));
      next.dueDate = d.toISOString().slice(0, 10);
    }
    setF(next);
  };

  /* เปลี่ยน "ออกในนาม" → คิดเลขวิ่งใหม่จากชุดนับที่ตรงกัน
     (นามบริษัท กับ นามบุคคล ใช้คนละชุดเลขวิ่ง กันเลขที่ใบกำกับภาษีบริษัทเกิดช่องว่าง) */
  const changeIssuedAs = (e) => {
    const issuedAs = e.target.value;
    let next = { ...f, issuedAs };
    if (mode === "add") {
      const alloc = allocateDocNumber(data.quotes, f.type, f.date, data.company, issuedAs);
      next = { ...next, period: alloc.period, running: alloc.running, code: alloc.code };
    }
    setF(next);
  };

  const changeCreditDays = (e) => {
    const days = e.target.value;
    let next = { ...f, creditDays: days };
    if (f.date && days) {
      const d = new Date(f.date + "T00:00:00");
      d.setDate(d.getDate() + Number(days));
      next.dueDate = d.toISOString().slice(0, 10);
    }
    setF(next);
  };

  /* เลือกลูกค้า → ดึงเครดิตของลูกค้ามาใช้ */
  const changeCustomer = (customerId) => {
    const cust = data.customers.find((c) => c.id === customerId);
    let next = { ...f, customerId };
    if (cust?.creditDays) {
      next.creditDays = cust.creditDays;
      if (f.date) {
        const d = new Date(f.date + "T00:00:00");
        d.setDate(d.getDate() + Number(cust.creditDays));
        next.dueDate = d.toISOString().slice(0, 10);
      }
    }
    setF(next);
  };

  /* เลือกโปรเจกต์ → ดึงเลข PO มาใส่ */
  const changeProject = (projectId) => {
    const proj = data.projects.find((p) => p.id === projectId);
    setF({
      ...f,
      projectId,
      refPO: proj?.poNumber || f.refPO,
      customerId: proj?.customerId || f.customerId,
    });
  };

  const setItem = (id, key, value) =>
    setF({
      ...f,
      items: f.items.map((it) => {
        if (it.id !== id) return it;
        const next = { ...it, [key]: value };
        // แยกวัสดุ/แรง: ราคา/หน่วยรวม (price) คำนวณจากผลบวกเสมอ ใช้ตัวเดียวกันกับตอนคำนวณยอดรวมเอกสาร
        if (key === "materialPrice" || key === "laborPrice") {
          next.price = (Number(next.materialPrice) || 0) + (Number(next.laborPrice) || 0);
        }
        return next;
      }),
    });
  const addItem = () =>
    setF({ ...f, items: [...f.items, { id: uid("it"), desc: "", qty: 1, unit: "งาน", price: 0, materialPrice: 0, laborPrice: 0, discount: 0, isHeader: false, isSub: false }] });
  const addHeaderItem = () =>
    setF({ ...f, items: [...f.items, { id: uid("it"), desc: "", qty: "", unit: "", price: 0, materialPrice: 0, laborPrice: 0, discount: 0, isHeader: true, isSub: false }] });
  // รายละเอียดย่อย — ยังนับยอดเงินตามปกติ แต่ไม่ขึ้นลำดับที่ใหม่ ยังถือว่าอยู่ในรายการเดียวกับแถวก่อนหน้า
  const addSubItem = () =>
    setF({ ...f, items: [...f.items, { id: uid("it"), desc: "", qty: 1, unit: "งาน", price: 0, materialPrice: 0, laborPrice: 0, discount: 0, isHeader: false, isSub: true }] });
  const toggleItemHeader = (id) =>
    setF({ ...f, items: f.items.map((it) => (it.id === id ? { ...it, isHeader: !it.isHeader, isSub: false, qty: it.isHeader ? 1 : "", unit: it.isHeader ? "งาน" : "" } : it)) });
  const toggleItemSub = (id) =>
    setF({ ...f, items: f.items.map((it) => (it.id === id ? { ...it, isSub: !it.isSub, isHeader: false } : it)) });
  const removeItem = (id) =>
    setF({ ...f, items: f.items.filter((it) => it.id !== id) });

  /* สลับโหมดแยกค่าวัสดุ/ค่าแรง — ตอนเปิด ให้เอาราคา/หน่วยเดิมมาใส่ช่องวัสดุไว้ก่อน (แรงเริ่มที่ 0)
     จะได้ไม่ต้องพิมพ์ราคาใหม่ทั้งหมด ค่อยแยกทีหลังได้ */
  const toggleSplitMaterialLabor = (e) => {
    const checked = e.target.checked;
    setF({
      ...f,
      splitMaterialLabor: checked,
      items: checked
        ? f.items.map((it) => ({
            ...it,
            materialPrice: it.materialPrice || it.price || 0,
            laborPrice: it.laborPrice || 0,
          }))
        : f.items,
    });
  };

  /* ปุ่มช่วยเติมข้อความงวดเบิกจากโปรเจกต์ */
  const project = data.projects.find((p) => p.id === f.projectId);
  const fillMilestone = (m) => {
    const value = Number(project?.budget || 0) * (Number(m.percent) || 0) / 100;
    const desc = `${project.name} งวดที่ ${m.no} ${m.condition || ""} เบิก ${m.percent}%${f.refPO ? `  PO ${f.refPO}` : ""}`;
    setF({
      ...f,
      items: [{ id: uid("it"), desc, qty: 1, unit: "งาน", price: value, discount: 0 }],
    });
  };

  const totals = computeFinTotal(f.items, f.vat, f.discount);

  return (
    <Modal
      title={
        mode === "add"
          ? isSet ? "สร้างชุดเอกสารเรียกเก็บ (วางบิล/แจ้งหนี้/กำกับภาษี/เสร็จรับเงิน)" : "สร้างใบเสนอราคา"
          : "แก้ไขเอกสาร"
      }
      onClose={onClose}
      xwide
    >
      <form
        className="form"
        onSubmit={(e) => { e.preventDefault(); if (!f.projectId || f.items.length === 0) return; onSave(f); }}
      >
        {isSet && (
          <div className="info-box">
            เอกสารชุดนี้ใช้เลขวิ่งเดียวกันทั้ง 4 ใบ — พิมพ์ได้ทุกแบบจากรายการเดียว:
            <div className="set-codes set-codes-inline">
              {SALES_SET_TYPES.map((t) => (
                <span key={t} className="set-code-chip">
                  {t} <b>{buildDocCode(t, f.period, f.running)}</b>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="form-grid-3">
          <div className="form-row">
            <label>เลขวิ่ง{isSet ? " (ใช้ร่วมกันทั้งชุด)" : ""}</label>
            <input
              type="number" min="1"
              value={f.running}
              onChange={(e) => {
                const running = e.target.value;
                setF({ ...f, running, code: buildDocCode(f.type, f.period, running) });
              }}
              className="mono-input"
            />
            {!isSet && <span className="field-hint mono-amt">เลขที่เอกสาร: {f.code}</span>}
          </div>
          <div className="form-row">
            <label>วันที่เอกสาร (ตั้งย้อนหลัง/ล่วงหน้าได้)</label>
            <input type="date" value={f.date} onChange={changeDate} />
          </div>
          <div className="form-row">
            <label>สถานะเอกสาร</label>
            <select value={f.status} onChange={set("status")}>
              {FIN_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="form-grid-3">
          <div className="form-row">
            <label>ออกในนาม * (เพื่อดูรายได้รวมจริงของธุรกิจ แยกจากที่ต้องยื่นภาษีในนามบริษัท)</label>
            <select value={f.issuedAs} onChange={changeIssuedAs}>
              {ISSUED_AS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <p className="field-hint">
              เลขที่เอกสารนามบริษัท กับ นามบุคคล นับแยกคนละชุดกัน — เลขที่ใบกำกับภาษีของบริษัทจะไม่มีช่องว่างจากการสลับนาม
            </p>
          </div>
        </div>

        <div className="form-grid-3">
          <div className="form-row">
            <label>โปรเจกต์ * (พิมพ์เพื่อค้นหา)</label>
            <Autocomplete
              options={data.projects.map((p) => ({ id: p.id, label: p.name, sublabel: p.code }))}
              value={f.projectId}
              onChange={changeProject}
              placeholder="พิมพ์ชื่อโปรเจกต์…"
              allowClear={false}
            />
          </div>
          <div className="form-row">
            <label>ลูกค้า (จากทะเบียน — พิมพ์เพื่อค้นหา)</label>
            <Autocomplete
              options={data.customers.map((c) => ({ id: c.id, label: c.nameTh, sublabel: c.code }))}
              value={f.customerId}
              onChange={changeCustomer}
              placeholder="พิมพ์ชื่อลูกค้า…"
            />
          </div>
          <div className="form-row">
            <label>เลขที่ใบสั่งซื้อ (PO)</label>
            <input value={f.refPO} onChange={set("refPO")} className="mono-input" />
          </div>
        </div>

        {!f.customerId && (
          <div className="form-row">
            <label>ชื่อลูกค้า (กรณีไม่มีในทะเบียน)</label>
            <input value={f.customerName} onChange={set("customerName")} />
          </div>
        )}

        <div className="form-grid-3">
          <div className="form-row">
            <label>เงื่อนไขชำระเงิน (วัน)</label>
            <input type="number" min="0" value={f.creditDays} onChange={changeCreditDays} />
          </div>
          <div className="form-row">
            <label>วันครบกำหนดชำระ</label>
            <input type="date" value={f.dueDate} onChange={set("dueDate")} />
          </div>
          {isSet && (
            <div className="form-row">
              <label>สถานะวางบิล</label>
              <select value={f.billingStatus} onChange={set("billingStatus")}>
                {BILLING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* ปุ่มเติมงวดเบิกอัตโนมัติ */}
        {project?.milestones?.length > 0 && (
          <div className="milestone-fill">
            <span className="muted">เติมข้อความงวดเบิกจากโปรเจกต์:</span>
            {project.milestones.map((m, i) => (
              <button key={i} type="button" className="chip" onClick={() => fillMilestone(m)}>
                งวด {m.no} · {m.percent}%{m.billed ? " (วางแล้ว)" : ""}
              </button>
            ))}
          </div>
        )}

        <FormDivider>รายการ</FormDivider>
        <label className="check-item" style={{ marginBottom: 10 }}>
          <input type="checkbox" checked={!!f.splitMaterialLabor} onChange={toggleSplitMaterialLabor} />
          แยกค่าวัสดุ/ค่าแรงในเอกสาร (ไม่ติ๊ก = ราคา/หน่วยรวมเป็นก้อนเดียวแบบเดิม)
        </label>
        <div className="items-table">
          <div className={`items-row-head ${f.splitMaterialLabor ? "items-row-split" : "items-row"}`}>
            <span>ลำดับ</span><span>รายการ</span><span>จำนวน</span><span>หน่วย</span>
            {f.splitMaterialLabor ? (
              <><span>ค่าวัสดุ/หน่วย</span><span>ค่าแรง/หน่วย</span></>
            ) : (
              <span>ราคา/หน่วย</span>
            )}
            <span>ส่วนลด</span><span>จำนวนเงิน</span><span></span>
          </div>
          {(() => {
            let runningNo = 0;
            return f.items.map((it) => {
              if (it.isHeader) {
                return (
                  <div className="items-row items-row-header" key={it.id}>
                    <span className="items-row-no items-row-no-header">—</span>
                    <input
                      className="items-header-input"
                      value={it.desc}
                      onChange={(e) => setItem(it.id, "desc", e.target.value)}
                      placeholder="พิมพ์หัวข้อ/หมวดงาน เช่น งวดที่ 1 — งานฐานราก"
                    />
                    <button type="button" className="icon-btn" onClick={() => toggleItemHeader(it.id)} title="เปลี่ยนเป็นรายการปกติ" aria-label="เปลี่ยนเป็นรายการ">↩</button>
                    <button type="button" className="icon-btn" onClick={() => removeItem(it.id)} aria-label="ลบรายการ">✕</button>
                  </div>
                );
              }
              // รายละเอียดย่อยไม่ขึ้นลำดับที่ใหม่ — ยังถือว่าอยู่ในรายการเดียวกับเลขล่าสุดด้านบน
              if (!it.isSub) runningNo += 1;
              return (
                <div className={`${f.splitMaterialLabor ? "items-row-split" : "items-row"} ${it.isSub ? "items-row-sub" : ""}`} key={it.id}>
                  <span className="items-row-no">{it.isSub ? "↳" : runningNo}</span>
                  <textarea
                    rows={2}
                    value={it.desc}
                    onChange={(e) => setItem(it.id, "desc", e.target.value)}
                    placeholder={it.isSub ? "รายละเอียดย่อยของรายการด้านบน เช่น เทคอนกรีต, ผูกเหล็ก" : "เช่น งานปรับพื้นที่ดินและปลูกหญ้าบริเวณหน้าโรงงาน งวดที่ 1 เมื่อได้รับใบสั่งซื้อ เบิก 20%"}
                  />
                  <input type="number" min="0" step="0.01" value={it.qty} onChange={(e) => setItem(it.id, "qty", e.target.value)} />
                  <input value={it.unit} onChange={(e) => setItem(it.id, "unit", e.target.value)} list="unit-suggestions" />
                  {f.splitMaterialLabor ? (
                    <>
                      <input type="number" min="0" step="0.01" value={it.materialPrice ?? 0} onChange={(e) => setItem(it.id, "materialPrice", e.target.value)} />
                      <input type="number" min="0" step="0.01" value={it.laborPrice ?? 0} onChange={(e) => setItem(it.id, "laborPrice", e.target.value)} />
                    </>
                  ) : (
                    <input type="number" min="0" step="0.01" value={it.price} onChange={(e) => setItem(it.id, "price", e.target.value)} />
                  )}
                  <input type="number" min="0" step="0.01" value={it.discount} onChange={(e) => setItem(it.id, "discount", e.target.value)} />
                  <span className="mono-amt">฿{baht(lineTotal(it))}</span>
                  <div className="row-actions">
                    <button type="button" className="icon-btn" onClick={() => toggleItemSub(it.id)} title={it.isSub ? "เปลี่ยนเป็นรายการหลัก (ขึ้นลำดับใหม่)" : "เปลี่ยนเป็นรายละเอียดย่อย (ไม่ขึ้นลำดับใหม่)"} aria-label="สลับรายละเอียดย่อย">↳</button>
                    <button type="button" className="icon-btn" onClick={() => toggleItemHeader(it.id)} title="เปลี่ยนเป็นหัวข้อ" aria-label="เปลี่ยนเป็นหัวข้อ">H</button>
                    <button type="button" className="icon-btn" onClick={() => removeItem(it.id)} aria-label="ลบรายการ">✕</button>
                  </div>
                </div>
              );
            });
          })()}
        </div>
        <div className="boq-add-row-buttons">
          <button type="button" className="btn btn-ghost btn-sm" onClick={addItem}>+ เพิ่มรายการ</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={addSubItem}>+ เพิ่มรายละเอียดย่อย (ไม่ขึ้นลำดับใหม่)</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={addHeaderItem}>+ เพิ่มหัวข้อ/หมวดงาน</button>
        </div>

        <div className="form-grid-2">
          <div className="form-row">
            <label className="vat-toggle">
              <input type="checkbox" checked={f.vat} onChange={(e) => setF({ ...f, vat: e.target.checked })} />
              คิดภาษีมูลค่าเพิ่ม 7%
            </label>
          </div>
          <div className="form-row">
            <label>ส่วนลดท้ายบิล (บาท)</label>
            <input type="number" min="0" step="0.01" value={f.discount} onChange={set("discount")} />
          </div>
        </div>

        <div className="totals-box">
          <div><span>รวมเป็นเงิน</span><span className="mono-amt">฿{baht(totals.subtotal)}</span></div>
          {totals.discount > 0 && <div><span>ส่วนลด</span><span className="mono-amt">฿{baht(totals.discount)}</span></div>}
          <div><span>ราคาสุทธิ</span><span className="mono-amt">฿{baht(totals.afterDiscount)}</span></div>
          {f.vat && <div><span>ภาษีมูลค่าเพิ่ม 7%</span><span className="mono-amt">฿{baht(totals.vatAmount)}</span></div>}
          <div className="totals-final"><span>จำนวนเงินรวมทั้งสิ้น</span><span className="mono-amt-lg">฿{baht(totals.total)}</span></div>
        </div>

        <FormDivider>ผู้ลงนาม (เลือกจากทะเบียนผู้ลงนาม)</FormDivider>
        {data.signers.length === 0 ? (
          <p className="muted">
            ยังไม่มีผู้ลงนามในทะเบียน — เพิ่มได้ที่เมนู "ผู้ลงนาม" แล้วชื่อจะขึ้นเป็นตัวเลือกที่นี่
          </p>
        ) : (
          <>
          <div className="form-grid-3">
            <div className="form-row">
              <label>ผู้จัดทำ / ผู้วางบิล</label>
              <select value={f.signerIssuer} onChange={set("signerIssuer")}>
                <option value="">— ไม่ระบุ —</option>
                {data.signers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>ผู้อนุมัติ</label>
              <select value={f.signerApprover} onChange={set("signerApprover")}>
                <option value="">— ไม่ระบุ —</option>
                {data.signers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>พนักงานขาย / ผู้ติดต่อ</label>
              <select value={f.signerSales} onChange={set("signerSales")}>
                <option value="">— ไม่ระบุ —</option>
                {data.signers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
          </div>
          {!isSet && (() => {
            const issuerSigner = data.signers.find((s) => s.name === f.signerIssuer);
            return (
              <div className="form-row">
                <label className="check-item">
                  <input
                    type="checkbox"
                    checked={f.showSignature}
                    onChange={(e) => setF({ ...f, showSignature: e.target.checked })}
                    disabled={!issuerSigner?.signatureImage}
                  />
                  ใส่รูปลายเซ็นจริงของ "ผู้เสนอราคา" อัตโนมัติ (วันที่จะตรงกับวันที่เอกสาร)
                  {!issuerSigner?.signatureImage && (
                    <span className="field-hint"> (คนนี้ยังไม่มีรูปลายเซ็นในทะเบียนผู้ลงนาม)</span>
                  )}
                </label>
              </div>
            );
          })()}
          </>
        )}

        {isSet && (
          <div className="form-grid-2">
            <div className="form-row">
              <label>วิธีชำระเงิน (สำหรับใบเสร็จรับเงิน)</label>
              <select value={f.paymentMethod} onChange={set("paymentMethod")}>
                <option value="">— ยังไม่ระบุ —</option>
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {f.paymentMethod === "เช็คธนาคาร" && (
              <div className="form-row">
                <label>เลขที่เช็ค</label>
                <input value={f.chequeNo} onChange={set("chequeNo")} className="mono-input" />
              </div>
            )}
          </div>
        )}

        {!isSet && (
          <div className="form-row">
            <div className="form-row-head">
              <label>เงื่อนไขการชำระเงิน (จะพิมพ์บนใบเสนอราคา)</label>
              {(() => {
                const proj = data.projects.find((p) => p.id === f.projectId);
                const ms = proj?.milestones || [];
                if (ms.length === 0) return null;
                return (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      const text = ms
                        .map((m) => `งวดที่ ${m.no}: ${m.percent || 0}%${m.condition ? ` — ${m.condition}` : ""}`)
                        .join("\n");
                      setF({ ...f, paymentTerms: text });
                    }}
                  >⤵ เติมจากงวดเบิกของโปรเจกต์</button>
                );
              })()}
            </div>
            <textarea
              rows={3}
              value={f.paymentTerms || ""}
              onChange={set("paymentTerms")}
              placeholder="เช่น งวดที่ 1: 50% เมื่อลงนามสัญญา&#10;งวดที่ 2: 25% เมื่องานแล้วเสร็จ 50%"
            />
          </div>
        )}

        <div className="form-row">
          <label>หมายเหตุภายใน (ไม่พิมพ์บนเอกสาร)</label>
          <textarea rows={2} value={f.note} onChange={set("note")} />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="btn btn-primary">บันทึกเอกสาร</button>
        </div>
        <datalist id="unit-suggestions">
          {(data.units || []).map((u) => <option key={u.id} value={u.name} />)}
        </datalist>
      </form>
    </Modal>
  );
}

/* ---------------------------------------------------------
   PrintSetConfigModal — กำหนดจำนวนต้นฉบับ/สำเนาแยกแต่ละประเภทเอกสาร
   ก่อนพิมพ์รวมทั้งชุดเป็น PDF เดียว
--------------------------------------------------------- */
function PrintSetConfigModal({ record, onConfirm, onClose }) {
  const [counts, setCounts] = useState(() =>
    Object.fromEntries(SALES_SET_TYPES.map((t) => [t, { original: 1, copy: 0 }]))
  );

  const setCount = (t, key, value) => {
    const n = Math.max(0, Math.min(20, Number(value) || 0));
    setCounts((prev) => ({ ...prev, [t]: { ...prev[t], [key]: n } }));
  };

  const totalPages = Object.values(counts).reduce((s, c) => s + c.original + c.copy, 0);

  return (
    <Modal title="กำหนดจำนวนพิมพ์แต่ละประเภทเอกสาร" onClose={onClose}>
      <div className="form">
        <p className="muted">เลือกจำนวนต้นฉบับ/สำเนาที่ต้องการของแต่ละประเภท แล้วรวมพิมพ์เป็น PDF เดียว</p>

        <div className="set-count-table set-count-table-light">
          <div className="set-count-row set-count-head">
            <span>ประเภทเอกสาร</span><span>ต้นฉบับ</span><span>สำเนา</span>
          </div>
          {SALES_SET_TYPES.map((t) => (
            <div className="set-count-row" key={t}>
              <span>{t}</span>
              <input
                type="number" min="0" max="20"
                value={counts[t].original}
                onChange={(e) => setCount(t, "original", e.target.value)}
                className="set-count-input"
              />
              <input
                type="number" min="0" max="20"
                value={counts[t].copy}
                onChange={(e) => setCount(t, "copy", e.target.value)}
                className="set-count-input"
              />
            </div>
          ))}
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={totalPages === 0}
            onClick={() => onConfirm(counts)}
          >🖶 พิมพ์รวม ({totalPages} แผ่น)</button>
        </div>
      </div>
    </Modal>
  );
}
