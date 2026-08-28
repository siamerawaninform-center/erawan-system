import { useState } from "react";
import { TitleBlock, Modal, EmptyState, Toolbar, FormDivider } from "../components/UI.jsx";
import { Autocomplete } from "../components/Autocomplete.jsx";
import { uid, baht, todayISO, bahtText, computeBoqTotals } from "../lib/format.js";
import { nextBoqCode, allocateDocNumber } from "../lib/docNumber.js";
import { BOQ_DEFAULT_MARKUP, FIN_STATUSES } from "../lib/constants.js";

/* ---------------------------------------------------------
   BOQ (Bill of Quantity) — รายการประมาณราคา ต่อโปรเจกต์
   โครงสร้างตามเทมเพลตจริง: หมวดงาน → ค่าวัสดุ+ค่าแรงงาน → รวม
   → ค่าดำเนินการและกำไร % → VAT → ส่วนลด → รวมทั้งสิ้น
--------------------------------------------------------- */


export default function BOQ({ data, upsert, remove, onPrint, setView }) {
  const [modal, setModal] = useState(null);
  const [quoteModal, setQuoteModal] = useState(null); // { boq }
  const list = data.boqs || [];
  const project = (id) => data.projects.find((p) => p.id === id);

  return (
    <div className="view">
      <TitleBlock
        eyebrow="11 — ประมาณราคา"
        title="BOQ (Bill of Quantity)"
        sheetNo={`${list.length} ฉบับ`}
        note="วิเคราะห์ต้นทุนก่อสร้างแยกค่าวัสดุ/ค่าแรง เพื่อคำนวณราคาที่บวกกำไรก่อนออกใบเสนอราคา"
      />

      <Toolbar>
        <span className="muted">{list.length === 0 ? "ยังไม่มี BOQ" : `มี BOQ ${list.length} ฉบับ`}</span>
        <button
          className="btn btn-primary"
          onClick={() => setModal({ mode: "add" })}
          disabled={data.projects.length === 0}
        >+ สร้าง BOQ</button>
      </Toolbar>

      {data.projects.length === 0 ? (
        <EmptyState title="ยังไม่มีโปรเจกต์ให้ทำ BOQ" body="เพิ่มโปรเจกต์อย่างน้อย 1 รายการก่อน" />
      ) : list.length === 0 ? (
        <EmptyState
          title="ยังไม่มี BOQ ในระบบ"
          body="สร้าง BOQ เพื่อวิเคราะห์ต้นทุนก่อนเสนอราคาลูกค้า"
          actionLabel="+ สร้าง BOQ แรก"
          onAction={() => setModal({ mode: "add" })}
        />
      ) : (
        <div className="card-grid">
          {list.map((b) => {
            const t = computeBoqTotals(b.items, b.markupPercent, b.vat, b.discount);
            const proj = project(b.projectId);
            return (
              <div className="card" key={b.id}>
                <div className="card-top"><span className="mono-code">{b.code}</span></div>
                <h4>{proj?.name || "—"}</h4>
                <p className="card-sub">{proj?.address || ""}</p>
                <p className="card-line">{(b.items || []).filter((it) => !it.isHeader).length} รายการ · กำไร {b.markupPercent || 0}%</p>
                <div className="amount-line">
                  <span>รวมเป็นเงินทั้งสิ้น</span>
                  <span className="mono-amt-lg">฿{baht(t.total)}</span>
                </div>
                <div className="card-actions">
                  <button className="btn btn-ghost" onClick={() => setModal({ mode: "edit", item: b })}>แก้ไข</button>
                  <button className="btn btn-ghost" onClick={() => onPrint(b)}>🖶 พิมพ์</button>
                  <button className="btn btn-ghost" onClick={() => setQuoteModal({ boq: b })}>📄 สร้างใบเสนอราคา</button>
                  <button
                    className="btn btn-danger"
                    onClick={() => { if (confirm(`ลบ BOQ "${b.code}"?`)) remove("boqs", b.id, "BOQ"); }}
                  >ลบ</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <BoqForm
          mode={modal.mode}
          item={modal.item}
          data={data}
          onSave={(item) => { upsert("boqs", item, "BOQ"); setModal(null); }}
          onClose={() => setModal(null)}
        />
      )}

      {quoteModal && (
        <QuoteFromBoqModal
          boq={quoteModal.boq}
          data={data}
          upsert={upsert}
          setView={setView}
          onClose={() => setQuoteModal(null)}
        />
      )}
    </div>
  );
}

function BoqForm({ mode, item, data, onSave, onClose }) {
  const [f, setF] = useState(() => {
    if (item) return item;
    const proj = data.projects[0];
    return {
      id: uid("boq"),
      projectId: proj?.id || "",
      projectCode: proj?.code || "",
      code: nextBoqCode(data.boqs, proj?.code || ""),
      date: todayISO(),
      markupPercent: BOQ_DEFAULT_MARKUP,
      vat: true,
      discount: 0,
      estimatorId: data.signers.find((s) => s.isDefault)?.id || "",
      showSignature: false,
      note: "",
      items: [{ id: uid("bi"), description: "", qty: 1, unit: "งาน", materialUnitPrice: 0, laborUnitPrice: 0, isHeader: false, isSub: false }],
    };
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const changeProject = (projectId) => {
    const proj = data.projects.find((p) => p.id === projectId);
    setF({
      ...f,
      projectId,
      projectCode: proj?.code || "",
      code: mode === "add" ? nextBoqCode(data.boqs, proj?.code || "") : f.code,
    });
  };

  const setItem = (id, key, value) =>
    setF({ ...f, items: f.items.map((it) => (it.id === id ? { ...it, [key]: value } : it)) });
  const addItem = () => {
    setF({ ...f, items: [...f.items, { id: uid("bi"), description: "", qty: 1, unit: "งาน", materialUnitPrice: 0, laborUnitPrice: 0, isHeader: false, isSub: false }] });
  };
  const addHeaderRow = () => {
    setF({ ...f, items: [...f.items, { id: uid("bi"), description: "", qty: 0, unit: "", materialUnitPrice: 0, laborUnitPrice: 0, isHeader: true, isSub: false }] });
  };
  // รายละเอียดย่อย — ยังนับยอดเงินตามปกติ แต่ไม่ขึ้นลำดับที่ใหม่ ยังถือว่าอยู่ในรายการเดียวกับแถวก่อนหน้า
  const addSubRow = () => {
    setF({ ...f, items: [...f.items, { id: uid("bi"), description: "", qty: 1, unit: "งาน", materialUnitPrice: 0, laborUnitPrice: 0, isHeader: false, isSub: true }] });
  };
  const toggleHeader = (id) =>
    setF({ ...f, items: f.items.map((it) => (it.id === id ? { ...it, isHeader: !it.isHeader, isSub: false, qty: it.isHeader ? 1 : 0 } : it)) });
  const toggleSub = (id) =>
    setF({ ...f, items: f.items.map((it) => (it.id === id ? { ...it, isSub: !it.isSub, isHeader: false } : it)) });
  const removeItem = (id) => setF({ ...f, items: f.items.filter((it) => it.id !== id) });
  const moveItem = (idx, dir) => {
    const next = idx + dir;
    if (next < 0 || next >= f.items.length) return;
    const items = [...f.items];
    [items[idx], items[next]] = [items[next], items[idx]];
    setF({ ...f, items });
  };

  const t = computeBoqTotals(f.items, f.markupPercent, f.vat, f.discount);
  const signer = data.signers.find((s) => s.id === f.estimatorId);

  return (
    <Modal title={mode === "add" ? "สร้าง BOQ" : "แก้ไข BOQ"} onClose={onClose} xwide>
      <form className="form" onSubmit={(e) => { e.preventDefault(); if (!f.projectId) return; onSave(f); }}>
        <div className="form-grid-3">
          <div className="form-row">
            <label>โปรเจกต์ * (พิมพ์เพื่อค้นหา)</label>
            <Autocomplete
              options={data.projects.map((p) => ({ id: p.id, label: p.name, sublabel: p.code }))}
              value={f.projectId}
              onChange={changeProject}
              allowClear={false}
            />
          </div>
          <div className="form-row">
            <label>รหัส BOQ</label>
            <input value={f.code} onChange={set("code")} className="mono-input" />
          </div>
          <div className="form-row">
            <label>วันที่ประมาณการ</label>
            <input type="date" value={f.date} onChange={set("date")} />
          </div>
        </div>

        <FormDivider>รายการหมวดงาน (ปรับลำดับ/แทรกหัวข้อได้อิสระแบบสเปรดชีต)</FormDivider>
        <div className="boq-table">
          <div className="boq-row boq-row-head boq-row-editable">
            <span>ลำดับ</span><span>รายการ</span><span>ปริมาณ</span><span>หน่วย</span>
            <span>ค่าวัสดุ/หน่วย</span><span>ค่าแรง/หน่วย</span><span>รวม</span><span></span>
          </div>
          {(() => {
            let runningNo = 0;
            return f.items.map((it, idx) => {
              if (it.isHeader) {
                return (
                  <div className="boq-row boq-row-editable boq-row-header-edit" key={it.id}>
                    <span className="boq-row-no boq-row-no-header">—</span>
                    <input
                      className="boq-header-input"
                      value={it.description}
                      onChange={(e) => setItem(it.id, "description", e.target.value)}
                      placeholder="พิมพ์หัวข้อ/พื้นที่ทำงาน เช่น หมวดงานฐานราก, ชั้น 2 ฝั่งตะวันออก…"
                    />
                    <div className="boq-row-tools">
                      <button type="button" className="icon-btn" onClick={() => moveItem(idx, -1)} disabled={idx === 0} aria-label="เลื่อนขึ้น">▲</button>
                      <button type="button" className="icon-btn" onClick={() => moveItem(idx, 1)} disabled={idx === f.items.length - 1} aria-label="เลื่อนลง">▼</button>
                      <button type="button" className="icon-btn" onClick={() => toggleHeader(it.id)} title="เปลี่ยนเป็นรายการปกติ" aria-label="เปลี่ยนเป็นรายการ">↩</button>
                      <button type="button" className="icon-btn" onClick={() => removeItem(it.id)} aria-label="ลบ">✕</button>
                    </div>
                  </div>
                );
              }
              // รายละเอียดย่อยไม่ขึ้นลำดับที่ใหม่ — ยังถือว่าอยู่ในรายการเดียวกับเลขล่าสุดด้านบน
              if (!it.isSub) runningNo += 1;
              const lineTotal = (Number(it.qty) || 0) * ((Number(it.materialUnitPrice) || 0) + (Number(it.laborUnitPrice) || 0));
              return (
                <div className={`boq-row boq-row-editable ${it.isSub ? "items-row-sub" : ""}`} key={it.id}>
                  <span className="mono-amt boq-row-no">{it.isSub ? "↳" : runningNo}</span>
                  <input value={it.description} onChange={(e) => setItem(it.id, "description", e.target.value)} placeholder={it.isSub ? "รายละเอียดย่อยของรายการด้านบน" : "เช่น งานโครงสร้างคอนกรีตเสริมเหล็ก"} />
                  <input type="number" min="0" step="0.01" value={it.qty} onChange={(e) => setItem(it.id, "qty", e.target.value)} />
                  <input value={it.unit} onChange={(e) => setItem(it.id, "unit", e.target.value)} list="unit-suggestions" />
                  <input type="number" min="0" step="0.01" value={it.materialUnitPrice} onChange={(e) => setItem(it.id, "materialUnitPrice", e.target.value)} />
                  <input type="number" min="0" step="0.01" value={it.laborUnitPrice} onChange={(e) => setItem(it.id, "laborUnitPrice", e.target.value)} />
                  <span className="mono-amt">฿{baht(lineTotal)}</span>
                  <div className="boq-row-tools">
                    <button type="button" className="icon-btn" onClick={() => moveItem(idx, -1)} disabled={idx === 0} aria-label="เลื่อนขึ้น">▲</button>
                    <button type="button" className="icon-btn" onClick={() => moveItem(idx, 1)} disabled={idx === f.items.length - 1} aria-label="เลื่อนลง">▼</button>
                    <button type="button" className="icon-btn" onClick={() => toggleSub(it.id)} title={it.isSub ? "เปลี่ยนเป็นรายการหลัก (ขึ้นลำดับใหม่)" : "เปลี่ยนเป็นรายละเอียดย่อย (ไม่ขึ้นลำดับใหม่)"} aria-label="สลับรายละเอียดย่อย">↳</button>
                    <button type="button" className="icon-btn" onClick={() => toggleHeader(it.id)} title="เปลี่ยนเป็นหัวข้อ/พื้นที่ทำงาน" aria-label="เปลี่ยนเป็นหัวข้อ">H</button>
                    <button type="button" className="icon-btn" onClick={() => removeItem(it.id)} aria-label="ลบ">✕</button>
                  </div>
                </div>
              );
            });
          })()}
        </div>
        <div className="boq-add-row-buttons">
          <button type="button" className="btn btn-ghost btn-sm" onClick={addItem}>+ เพิ่มหมวดงาน</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={addSubRow}>+ เพิ่มรายละเอียดย่อย (ไม่ขึ้นลำดับใหม่)</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={addHeaderRow}>+ เพิ่มหัวข้อ/พื้นที่ทำงาน</button>
        </div>

        <div className="form-grid-3">
          <div className="form-row">
            <label>ค่าดำเนินการและกำไร (%)</label>
            <input type="number" min="0" step="0.01" value={f.markupPercent} onChange={set("markupPercent")} />
          </div>
          <div className="form-row">
            <label className="vat-toggle">
              <input type="checkbox" checked={f.vat} onChange={(e) => setF({ ...f, vat: e.target.checked })} />
              คิดภาษีมูลค่าเพิ่ม 7%
            </label>
          </div>
          <div className="form-row">
            <label>ส่วนลด (บาท)</label>
            <input type="number" min="0" step="0.01" value={f.discount} onChange={set("discount")} />
          </div>
        </div>

        <div className="totals-box">
          <div><span>ค่าวัสดุรวม</span><span className="mono-amt">฿{baht(t.materialTotal)}</span></div>
          <div><span>ค่าแรงงานรวม</span><span className="mono-amt">฿{baht(t.laborTotal)}</span></div>
          <div><span>รวมค่าก่อสร้าง</span><span className="mono-amt">฿{baht(t.constructionTotal)}</span></div>
          <div><span>ค่าดำเนินการและกำไร ({f.markupPercent || 0}%)</span><span className="mono-amt">฿{baht(t.markupAmount)}</span></div>
          <div><span>รวมค่าก่อสร้าง+กำไร</span><span className="mono-amt">฿{baht(t.afterMarkup)}</span></div>
          {f.vat && <div><span>ภาษีมูลค่าเพิ่ม 7%</span><span className="mono-amt">฿{baht(t.vatAmount)}</span></div>}
          {Number(f.discount) > 0 && <div><span>ส่วนลด</span><span className="mono-amt">฿{baht(f.discount)}</span></div>}
          <div className="totals-final"><span>รวมเป็นเงินทั้งสิ้น</span><span className="mono-amt-lg">฿{baht(t.total)}</span></div>
          <div className="bahttext-hint">({bahtText(t.total)})</div>
        </div>

        <FormDivider>ผู้ประมาณการ</FormDivider>
        <div className="form-grid-2">
          <div className="form-row">
            <label>ผู้ประมาณการ</label>
            <select value={f.estimatorId} onChange={set("estimatorId")}>
              <option value="">— ไม่ระบุ —</option>
              {data.signers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label className="check-item">
              <input
                type="checkbox"
                checked={f.showSignature}
                onChange={(e) => setF({ ...f, showSignature: e.target.checked })}
                disabled={!signer?.signatureImage}
              />
              แสดงรูปลายเซ็นจริงตอนพิมพ์
              {!signer?.signatureImage && <span className="field-hint"> (ผู้ลงนามคนนี้ยังไม่มีรูปลายเซ็นในทะเบียน)</span>}
            </label>
          </div>
        </div>
        <div className="form-row">
          <label>หมายเหตุ</label>
          <textarea rows={2} value={f.note} onChange={set("note")} placeholder="เช่น ไม่รวมราคาโครงสร้างชั่วคราว" />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="btn btn-primary">บันทึก BOQ</button>
        </div>
        <datalist id="unit-suggestions">
          {(data.units || []).map((u) => <option key={u.id} value={u.name} />)}
        </datalist>
      </form>
    </Modal>
  );
}

/* ---------------------------------------------------------
   สร้างใบเสนอราคาจาก BOQ — คิดราคาขายจากต้นทุน (วัสดุ+แรงงาน)
   บวกเปอร์เซ็นต์ที่กำหนดเอง โดยไม่โชว์ต้นทุน/% กำไรให้ลูกค้าเห็นในเอกสาร
--------------------------------------------------------- */
function QuoteFromBoqModal({ boq, data, upsert, setView, onClose }) {
  const project = data.projects.find((p) => p.id === boq.projectId);
  const [markup, setMarkup] = useState(boq.markupPercent || BOQ_DEFAULT_MARKUP);

  const preview = (boq.items || []).map((it) => {
    if (it.isHeader) return { ...it, unitCost: 0, sellPrice: 0 };
    const unitCost = (Number(it.materialUnitPrice) || 0) + (Number(it.laborUnitPrice) || 0);
    const sellPrice = unitCost * (1 + (Number(markup) || 0) / 100);
    return { ...it, unitCost, sellPrice };
  });

  const createQuote = () => {
    const defaultSigner = data.signers.find((s) => s.isDefault);
    const today = todayISO();
    const alloc = allocateDocNumber(data.quotes, "ใบเสนอราคา", today, data.company);
    const newQuote = {
      id: uid("fin"),
      kind: "quote",
      type: "ใบเสนอราคา",
      issuedAs: "นามบริษัท", // งานที่มาจาก BOQ ถือเป็นงานในนามบริษัทเสมอ
      period: alloc.period,
      running: alloc.running,
      code: alloc.code,
      projectId: boq.projectId,
      customerId: project?.customerId || "",
      customerName: project?.clientName || "",
      status: FIN_STATUSES[0],
      date: today,
      dueDate: "",
      creditDays: 30,
      refPO: project?.poNumber || "",
      vat: true,
      discount: 0,
      paymentMethod: "",
      chequeNo: "",
      signerIssuer: defaultSigner?.name || "",
      signerApprover: defaultSigner?.name || "",
      signerSales: defaultSigner?.name || "",
      items: preview.map((it) => ({
        id: uid("it"), desc: it.description, qty: it.isHeader ? "" : it.qty, unit: it.isHeader ? "" : it.unit,
        price: it.isHeader ? 0 : Math.round(it.sellPrice * 100) / 100, discount: 0, isHeader: !!it.isHeader, isSub: !!it.isSub,
      })),
      paymentTerms: "",
      boqId: boq.id, // ลิงก์อ้างอิงภายในเท่านั้น — ไม่แสดงในเอกสารที่พิมพ์
      note: "",
    };
    upsert("quotes", newQuote, "ใบเสนอราคา");
    onClose();
    if (setView) setView("finance");
  };

  return (
    <Modal title="สร้างใบเสนอราคาจาก BOQ" onClose={onClose} xwide>
      <div className="form">
        <p className="muted">
          ดึงรายการจาก BOQ <b>{boq.code}</b> มาคิดราคาขายให้อัตโนมัติ —
          ราคาต่อหน่วยจะถูกปัดรวมเป็นยอดเดียว <b>ไม่แสดงต้นทุนหรือ % กำไรในเอกสารที่ส่งลูกค้า</b>
          ปรับ % หรือแก้ราคาแต่ละรายการเองภายหลังได้ในหน้าแก้ไขใบเสนอราคา
        </p>

        <div className="form-row">
          <label>บวกเพิ่มจากต้นทุนกี่ % ต่อรายการ (ปรับทีเดียวทุกรายการ)</label>
          <input
            type="number" min="0" step="0.01"
            value={markup}
            onChange={(e) => setMarkup(e.target.value)}
            className="mono-input"
            style={{ maxWidth: 160 }}
          />
        </div>

        <FormDivider>พรีวิวราคาที่จะใช้ในใบเสนอราคา</FormDivider>
        <div className="boq-table">
          <div className="boq-row boq-row-head" style={{ gridTemplateColumns: "2fr 70px 70px 100px" }}>
            <span>รายการ</span><span>ปริมาณ</span><span>หน่วย</span><span>ราคา/หน่วย (ที่ลูกค้าเห็น)</span>
          </div>
          {preview.map((it) => (
            it.isHeader ? (
              <div className="boq-row boq-row-header-preview" key={it.id} style={{ gridTemplateColumns: "1fr" }}>
                <span>{it.description || "—"}</span>
              </div>
            ) : (
              <div className="boq-row" key={it.id} style={{ gridTemplateColumns: "2fr 70px 70px 100px" }}>
                <span>{it.description || "—"}</span>
                <span>{it.qty}</span>
                <span>{it.unit}</span>
                <span className="mono-amt">฿{baht(it.sellPrice)}</span>
              </div>
            )
          ))}
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button type="button" className="btn btn-primary" onClick={createQuote}>สร้างใบเสนอราคา</button>
        </div>
      </div>
    </Modal>
  );
}
