import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Logo } from "./UI.jsx";
import {
  baht, bahtText, formatShortThaiDate, computeFinTotal, lineTotal, num,
} from "../lib/format.js";
import { buildDocCode } from "../lib/docNumber.js";
import { COMPANY_DEFAULT, FIN_TYPE_EN, PAYMENT_METHODS } from "../lib/constants.js";

/* ---------------------------------------------------------
   เอกสารพิมพ์ขนาด A4 — ทำตามเทมเพลตจริงของบริษัท
   มีหน้าพรีวิวก่อนพิมพ์ทุกครั้ง + เลือกต้นฉบับ/สำเนา

   ใบวางบิล ใช้ตารางแบบ "รายการเอกสาร" (อ้างอิงเลขใบกำกับภาษี)
   ใบอื่น   ใช้ตารางแบบ "รายการสินค้า/บริการ"
--------------------------------------------------------- */

/* ---------------------------------------------------------
   DocPage — เนื้อหากระดาษ A4 หนึ่งแผ่น (ใช้ซ้ำได้ทั้งพิมพ์ทีละใบ และพิมพ์รวมทั้งชุด)
--------------------------------------------------------- */
export function DocPage({ record, printType, copyType, data, pageBreak }) {
  const company = { ...COMPANY_DEFAULT, ...(data.company || {}) };
  const customer = data.customers.find((c) => c.id === record.customerId);
  const project = data.projects.find((p) => p.id === record.projectId);
  const issuerSigner = data.signers.find((s) => s.name === record.signerIssuer);
  const totals = computeFinTotal(record.items, record.vat, record.discount);

  const isBilling = printType === "ใบวางBิล" || printType === "ใบวางบิล";
  const isReceipt = printType === "ใบเสร็จรับเงิน";
  const isQuote = printType === "ใบเสนอราคา";

  const docCode = record.kind === "salesSet"
    ? buildDocCode(printType, record.period, record.running)
    : record.code;

  const taxInvoiceCode = record.kind === "salesSet"
    ? buildDocCode("ใบกำกับภาษี", record.period, record.running)
    : "";

  const custName = customer?.nameTh || record.customerName || "";
  const custBranch = customer?.branch ? ` สาขา ${customer.branch}` : "";

  // ย่อขนาดเนื้อหาอัตโนมัติให้พอดี 1 หน้า A4 เสมอ ไม่ว่าจำนวนรายการจะมากแค่ไหน
  const pageRef = useRef(null);
  const contentRef = useRef(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const page = pageRef.current;
    const content = contentRef.current;
    if (!page || !content) return;

    const recalc = () => {
      // วัดความสูงจริงที่ขนาดเต็ม 100% ก่อนเสมอ
      content.style.zoom = 1;
      const cs = getComputedStyle(page);
      const padTop = parseFloat(cs.paddingTop) || 0;
      const padBottom = parseFloat(cs.paddingBottom) || 0;
      const availableHeight = page.clientHeight - padTop - padBottom;
      const naturalHeight = content.scrollHeight;
      if (naturalHeight > availableHeight && naturalHeight > 0) {
        // เผื่อระยะกันชน 4% กันเนื้อหาชนขอบพอดีเป๊ะเกินไป (เผื่อขอบพิมพ์ไม่ได้ของเครื่องพิมพ์จริง)
        setScale((availableHeight / naturalHeight) * 0.96);
      } else {
        setScale(1);
      }
    };

    recalc();
    // คำนวณซ้ำทันทีก่อนพิมพ์จริง กันกรณีฟอนต์เรนเดอร์ต่างกันเล็กน้อยระหว่างหน้าจอกับตอนพิมพ์
    window.addEventListener("beforeprint", recalc);
    return () => window.removeEventListener("beforeprint", recalc);
  }, [record, printType, copyType, data]);

  return (
    <div className={`print-area a4${pageBreak ? " print-page-break" : ""}`} ref={pageRef}>
        <div className="doc-ribbon">{copyType === "ต้นฉบับ (ORIGINAL)" ? "ต้นฉบับ" : "สำเนา"}</div>

        <div
          ref={contentRef}
          className="doc-page-inner"
          style={{ zoom: scale }}
        >
        {/* หัวเอกสาร */}
        <div className="doc-top">
          <div className="doc-company">
            <Logo size={58} />
            <div className="doc-company-text">
              <div className="dc-name">{company.nameTh}</div>
              <div className="dc-line">{company.address}</div>
              <div className="dc-line">โทรศัพท์. {company.phone}</div>
              <div className="dc-line">
                E-mail : {company.email}
                <span className="dc-taxid">เลขประจำตัวผู้เสียภาษี {company.taxId}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="doc-top-rule" />

        {/* ชื่อเอกสาร */}
        <div className="doc-name-wrap">
          <div className="doc-name">
            {printType} ({FIN_TYPE_EN[printType] || ""})
          </div>
        </div>

        {/* กล่องข้อมูลลูกค้า */}
        <div className="doc-party">
          <div className="dp-left">
            <div className="dp-row">
              <span className="dp-k">รหัสลูกค้า</span>
              <span className="dp-v mono-amt">{customer?.code || "—"}</span>
              <span className="dp-k dp-k2">เลขประจำตัวผู้เสียภาษี</span>
              <span className="dp-v mono-amt">{customer?.taxId || "—"}</span>
            </div>
            <div className="dp-row dp-row-block">
              <span className="dp-k">ชื่อ</span>
              <span className="dp-v dp-strong">{custName}{custBranch}</span>
            </div>
            <div className="dp-row dp-row-block">
              <span className="dp-k">ที่อยู่</span>
              <span className="dp-v">{customer?.address || project?.address || ""}</span>
            </div>
            {isQuote && project && (
              <div className="dp-row dp-row-block">
                <span className="dp-k">โครงการ</span>
                <span className="dp-v">{project.name}</span>
              </div>
            )}
            <div className="dp-row">
              <span className="dp-k">เบอร์โทร</span>
              <span className="dp-v">{customer?.phone || "—"}</span>
              <span className="dp-k dp-k2">แฟกซ์</span>
              <span className="dp-v">{customer?.fax || "—"}</span>
            </div>
            <div className="dp-row">
              <span className="dp-k">E-mail</span>
              <span className="dp-v">{customer?.email || "—"}</span>
            </div>
          </div>

          <div className="dp-right">
            <div className="dp-row2">
              <span className="dp-k">วันที่</span>
              <span className="dp-v mono-amt">{formatShortThaiDate(record.date)}</span>
            </div>
            <div className="dp-row2">
              <span className="dp-k">{isBilling ? "เลขที่บิล" : "เลขที่บิล"}</span>
              <span className="dp-v mono-amt">{docCode}</span>
            </div>
            {!isBilling && !isQuote && (
              <>
                <div className="dp-row2">
                  <span className="dp-k">เงื่อนไขการชำระเงิน</span>
                  <span className="dp-v mono-amt">{record.creditDays || 0} วัน</span>
                </div>
                <div className="dp-row2">
                  <span className="dp-k">วันครบกำหนดชำระ</span>
                  <span className="dp-v mono-amt">{formatShortThaiDate(record.dueDate) || "—"}</span>
                </div>
              </>
            )}
            {isBilling ? (
              <div className="dp-sig-inline">
                <span className="dp-k">ผู้วางบิล</span>
                <span className="dp-sig-line-inline" />
                <span className="dp-sig-name">( {record.signerIssuer || "—"} )</span>
              </div>
            ) : (
              <>
                <div className="dp-row2">
                  <span className="dp-k">ผู้ติดต่อ</span>
                  <span className="dp-v">{customer?.contactName || ""}</span>
                </div>
                <div className="dp-row2">
                  <span className="dp-k">พนักงานขาย</span>
                  <span className="dp-v">{record.signerSales || "—"}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ตารางรายการ */}
        {isBilling ? (
          <table className="doc-table doc-table-fill">
            <thead>
              <tr>
                <th style={{ width: "10%" }}>ลำดับที่</th>
                <th style={{ width: "20%" }}>วันที่เอกสาร</th>
                <th style={{ width: "28%" }}>เลขที่เอกสาร</th>
                <th style={{ width: "22%" }}>จำนวนเงิน</th>
                <th style={{ width: "20%" }}>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="doc-center">1</td>
                <td className="doc-center">{formatShortThaiDate(record.date)}</td>
                <td className="doc-center mono-amt">{taxInvoiceCode}</td>
                <td className="doc-num">{baht(totals.total)}</td>
                <td className="doc-center">{record.refPO || ""}</td>
              </tr>
              {/* แถวเปล่าให้เต็มหน้ากระดาษ */}
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="doc-blank-row"><td></td><td></td><td></td><td></td><td></td></tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="doc-foot-empty"></td>
                <td className="doc-foot-label">รวมเงินทั้งสิ้น</td>
                <td className="doc-num doc-foot-total">{baht(totals.total)}</td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <table className="doc-table doc-table-fill">
            <thead>
              <tr>
                <th style={{ width: "8%" }}>ลำดับที่</th>
                <th style={{ width: "42%" }}>รายการ</th>
                <th style={{ width: "10%" }}>จำนวน</th>
                <th style={{ width: "14%" }}>ราคา / หน่วย</th>
                <th style={{ width: "12%" }}>ส่วนลด</th>
                <th style={{ width: "14%" }}>จำนวนเงิน</th>
              </tr>
            </thead>
            <tbody>
              {(record.items || []).map((it, i) => (
                <tr key={it.id}>
                  <td className="doc-center">{i + 1}</td>
                  <td className="doc-desc">{it.desc}</td>
                  <td className="doc-center">{num(it.qty)} {it.unit}</td>
                  <td className="doc-num">{baht(it.price)}</td>
                  <td className="doc-num">{baht(it.discount)}</td>
                  <td className="doc-num">{baht(lineTotal(it))}</td>
                </tr>
              ))}
              {Array.from({ length: Math.max(0, 6 - (record.items?.length || 0)) }).map((_, i) => (
                <tr key={i} className="doc-blank-row">
                  <td></td><td></td><td></td><td></td><td></td><td></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {isQuote && record.paymentTerms && (
          <div className="payment-terms-box">
            <div className="payment-terms-title">เงื่อนไขการชำระเงิน</div>
            <div className="payment-terms-body">{record.paymentTerms}</div>
          </div>
        )}

        {/* กล่องท้ายเอกสาร */}
        {!isBilling && (
          <div className="doc-footer-grid">
            {!isQuote && (
              <div className="dfg-left">
                <div className="dfg-cheque">
                  <div>กรณีสั่งจ่ายเป็นเช็ค</div>
                  <div>{company.chequeNote}</div>
                </div>
                <div className="dfg-bahttext">( {bahtText(totals.total)} )</div>
              </div>
            )}
            <div className={`dfg-right ${isQuote ? "dfg-right-full" : ""}`}>
              <div className="dfg-row"><span>ยอดรวม</span><span className="mono-amt">{baht(totals.subtotal)}</span></div>
              <div className="dfg-row"><span>ส่วนลด</span><span className="mono-amt">{baht(totals.discount)}</span></div>
              <div className="dfg-row"><span>ราคาสุทธิหลังหักส่วนลด</span><span className="mono-amt">{baht(totals.afterDiscount)}</span></div>
              <div className="dfg-row">
                <span>ภาษีมูลค่าเพิ่ม {record.vat ? "7.0%" : "—"}</span>
                <span className="mono-amt">{baht(totals.vatAmount)}</span>
              </div>
              <div className="dfg-row dfg-total">
                <span>จำนวนเงินรวมทั้งสิ้น</span>
                <span className="mono-amt">{baht(totals.total)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ช่องลงนาม */}
        {isBilling ? (
          <div className="doc-sign-billing">
            <div className="dsbn-single">
              <div className="dsbn-inname">ในนามลูกค้า</div>
              <div className="dsbn-line" />
              <div className="dsbn-labels"><span>ผู้รับวางบิล</span></div>
              <div className="dsbn-daterow">
                <div className="dsbn-subrow">
                  <span>วันที่รับวางบิล</span><span className="dsbn-subline" />
                </div>
                <div className="dsbn-subrow">
                  <span>วันที่ชำระเงิน</span><span className="dsbn-subline" />
                </div>
              </div>
            </div>
          </div>
        ) : isQuote ? (
          <div className="quote-sign-grid">
            <div className="quote-sig-col">
              <div className="quote-sig-inname">ในนามบริษัท {company.nameEn}</div>
              {record.showSignature && issuerSigner?.signatureImage ? (
                <div className="quote-sig-imgwrap">
                  <img src={issuerSigner.signatureImage} alt="ลายเซ็น" className="quote-sig-img" />
                </div>
              ) : (
                <div className="quote-sig-line" />
              )}
              <div className="quote-sig-name">( {record.signerIssuer || "—"} )</div>
              <div className="quote-sig-role">ผู้เสนอราคา</div>
              <div className="quote-sig-date">วันที่ {formatShortThaiDate(record.date)}</div>
            </div>
            <div className="quote-sig-col">
              <div className="quote-sig-inname">ในนามลูกค้า (ผู้อนุมัติสั่งซื้อ)</div>
              <div className="quote-sig-line" />
              <div className="quote-sig-name quote-sig-blank">
                <span>(</span><span className="quote-sig-blank-space" /><span>)</span>
              </div>
              <div className="quote-sig-role">ผู้อนุมัติสั่งซื้อ</div>
              <div className="quote-sig-date">วันที่ ......../......../..........</div>
            </div>
          </div>
        ) : (
          <div className="doc-sign-grid">
            <div className="dsg-col">
              <div className="dsg-note">ได้รับสินค้าในสภาพเรียบร้อย ครบถ้วน</div>
              <div className="dsg-note">พร้อมได้รับใบกำกับภาษีเรียบร้อยแล้ว</div>
              <div className="dsg-field"><span>ผู้รับของ</span><span className="dsg-line" /><span>วันที่</span><span className="dsg-line dsg-line-sm" /></div>
              <div className="dsg-field">
                <span>ผู้ส่งของ</span>
                <span className="dsg-line" />
              </div>
              <div className="dsg-paren">( {record.signerIssuer || "—"} )</div>
            </div>

            <div className="dsg-col">
              <div className="dsg-field">
                <span>ผู้รับเงิน</span>
                <span className="dsg-line" />
                <span>ตัวบรรจง</span>
              </div>
              {isReceipt && <div className="dsg-paren">( {record.signerIssuer || "—"} )</div>}
              <div className="dsg-field"><span>วันที่</span><span className="dsg-line" /></div>
              {PAYMENT_METHODS.map((m) => (
                <div className="dsg-check" key={m}>
                  <span className={`dsg-box ${record.paymentMethod === m ? "dsg-box-checked" : ""}`}>
                    {record.paymentMethod === m ? "✓" : ""}
                  </span>
                  <span>{m}</span>
                  {m === "เช็คธนาคาร" && (
                    <>
                      <span className="dsg-line dsg-line-sm">{record.chequeNo}</span>
                      <span>เลขที่</span>
                    </>
                  )}
                </div>
              ))}
              <div className="dsg-field"><span>ลงวันที่</span><span className="dsg-line" /></div>
            </div>

            <div className="dsg-col dsg-col-sign">
              <div className="dsg-sig">
                <span className="dsg-sig-line" />
                <span className="dsg-paren">( {record.signerIssuer || "—"} )</span>
                <span className="dsg-role">ผู้จัดทำ</span>
              </div>
              <div className="dsg-sig">
                <span className="dsg-sig-line" />
                <span className="dsg-paren">( {record.signerApprover || "—"} )</span>
                <span className="dsg-role">ผู้อนุมัติ</span>
              </div>
            </div>
          </div>
        )}
        </div>
    </div>
  );
}

export default function PrintDoc({ payload, data, onClose }) {
  const { record, printType } = payload;
  const [copyType, setCopyType] = useState("ต้นฉบับ (ORIGINAL)");

  // เลขที่เอกสารของประเภทที่กำลังพิมพ์
  const docCode = record.kind === "salesSet"
    ? buildDocCode(printType, record.period, record.running)
    : record.code;

  // ตั้งชื่อไฟล์ตอนพิมพ์/บันทึก PDF ให้ตรงกับเลขที่เอกสารอัตโนมัติ
  useEffect(() => {
    const prevTitle = document.title;
    document.title = docCode;
    return () => { document.title = prevTitle; };
  }, [docCode]);

  return (
    <div className="print-overlay">
      {/* แถบเครื่องมือ — ไม่พิมพ์ออกมา */}
      <div className="print-toolbar no-print">
        <div className="pt-left">
          <span className="pt-label">พรีวิวก่อนพิมพ์</span>
          <select value={copyType} onChange={(e) => setCopyType(e.target.value)}>
            <option>ต้นฉบับ (ORIGINAL)</option>
            <option>สำเนา (COPY)</option>
          </select>
        </div>
        <div className="pt-right">
          <button className="btn btn-ghost" onClick={onClose}>✕ ปิด</button>
          <button className="btn btn-primary" onClick={() => window.print()}>🖶 พิมพ์ / บันทึก PDF</button>
        </div>
      </div>

      <DocPage record={record} printType={printType} copyType={copyType} data={data} />
    </div>
  );
}

/* ---------------------------------------------------------
   PrintDocSet — พิมพ์รวมทั้งชุดเอกสาร (วางบิล+แจ้งหนี้+กำกับภาษี+เสร็จ)
   เป็น PDF เดียว เลือกได้ว่าจะรวมประเภทไหนบ้าง และกี่ชุด (ต้นฉบับ/สำเนา)
--------------------------------------------------------- */
const SET_DOC_TYPES = ["ใบวางบิล", "ใบแจ้งหนี้", "ใบกำกับภาษี", "ใบเสร็จรับเงิน"];

export function PrintDocSet({ payload, data, onClose }) {
  const { record } = payload;
  // จำนวนแยกแต่ละประเภทเอกสาร: { [type]: { original: N, copy: M } }
  const [counts, setCounts] = useState(() =>
    Object.fromEntries(SET_DOC_TYPES.map((t) => [t, { original: 1, copy: 0 }]))
  );

  const docCode = buildDocCode("ใบวางบิล", record.period, record.running);
  useEffect(() => {
    const prevTitle = document.title;
    document.title = `ชุดเอกสาร-${docCode}`;
    return () => { document.title = prevTitle; };
  }, [docCode]);

  const setCount = (t, key, value) => {
    const n = Math.max(0, Math.min(20, Number(value) || 0));
    setCounts((prev) => ({ ...prev, [t]: { ...prev[t], [key]: n } }));
  };

  // เรียงตามลำดับประเภทเอกสาร แต่ละประเภทพิมพ์ต้นฉบับก่อนแล้วตามด้วยสำเนา ตามจำนวนที่ตั้งไว้
  const pages = [];
  SET_DOC_TYPES.forEach((t) => {
    const c = counts[t] || { original: 0, copy: 0 };
    for (let i = 0; i < c.original; i++) pages.push({ printType: t, copyType: "ต้นฉบับ (ORIGINAL)" });
    for (let i = 0; i < c.copy; i++) pages.push({ printType: t, copyType: "สำเนา (COPY)" });
  });

  return (
    <div className="print-overlay">
      <div className="print-toolbar no-print print-toolbar-set">
        <div className="pt-left pt-left-set">
          <span className="pt-label">พรีวิวก่อนพิมพ์ — พิมพ์รวมทั้งชุด ({pages.length} แผ่น)</span>
          <div className="set-count-table">
            <div className="set-count-row set-count-head">
              <span>ประเภทเอกสาร</span><span>ต้นฉบับ</span><span>สำเนา</span>
            </div>
            {SET_DOC_TYPES.map((t) => (
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
        </div>
        <div className="pt-right">
          <button className="btn btn-ghost" onClick={onClose}>✕ ปิด</button>
          <button className="btn btn-primary" onClick={() => window.print()} disabled={pages.length === 0}>🖶 พิมพ์รวม / บันทึก PDF เดียว</button>
        </div>
      </div>

      {pages.length === 0 ? (
        <p className="no-print" style={{ padding: 24 }}>ตั้งจำนวนอย่างน้อย 1 แผ่นสำหรับเอกสารประเภทใดประเภทหนึ่ง</p>
      ) : (
        pages.map((p, i) => (
          <DocPage
            key={`${p.printType}-${p.copyType}-${i}`}
            record={record}
            printType={p.printType}
            copyType={p.copyType}
            data={data}
            pageBreak={i < pages.length - 1}
          />
        ))
      )}
    </div>
  );
}
