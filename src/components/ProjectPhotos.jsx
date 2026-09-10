import { useState, useEffect, useCallback } from "react";
import { Modal, FormDivider } from "./UI.jsx";
import { supabase } from "../supabaseClient.js";
import { todayISO } from "../lib/format.js";

/* ---------------------------------------------------------
   รูปภาพงาน — อัปโหลดจากหน้าเว็บ เก็บไฟล์จริงไว้ที่ Google Drive
   จัดโฟลเดอร์อัตโนมัติ: [โปรเจกต์] / [ปี] / [เดือน]
   ตารางในระบบ (project_photos) เก็บแค่ลิงก์ ไม่ได้เก็บไฟล์จริง
--------------------------------------------------------- */

const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

export default function ProjectPhotosModal({ project, onClose }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [takenAt, setTakenAt] = useState(todayISO());
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");

  const loadPhotos = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    const { data, error: err } = await supabase
      .from("project_photos")
      .select("*")
      .eq("project_id", project.id)
      .order("taken_at", { ascending: false });
    if (!err) setPhotos(data || []);
    setLoading(false);
  }, [project.id]);

  useEffect(() => { loadPhotos(); }, [loadPhotos]);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (!supabase) { setError("ยังไม่ได้ตั้งค่า Supabase — อัปโหลดรูปได้เฉพาะตอนต่อฐานข้อมูลกลางแล้ว"); return; }

    setUploading(true);
    setError("");
    for (const file of files) {
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("projectCode", project.code || "");
        form.append("projectName", project.name || "");
        form.append("takenAt", takenAt);

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-project-photo`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
            body: form,
          }
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "อัปโหลดไม่สำเร็จ");

        await supabase.from("project_photos").insert({
          project_id: project.id,
          project_code: project.code || "",
          drive_file_id: json.driveFileId,
          drive_url: json.driveUrl,
          taken_at: takenAt,
          year: json.year,
          month: json.month,
          caption,
        });
      } catch (err) {
        setError(`อัปโหลด "${file.name}" ไม่สำเร็จ: ${err.message}`);
      }
    }
    setUploading(false);
    setCaption("");
    e.target.value = "";
    loadPhotos();
  };

  // จัดกลุ่มรูปตาม ปี → เดือน ให้ดูง่ายเหมือนโฟลเดอร์ใน Drive
  const groups = {};
  photos.forEach((p) => {
    const key = `${p.year}-${p.month}`;
    (groups[key] = groups[key] || []).push(p);
  });
  const groupKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  return (
    <Modal title={`รูปภาพงาน — ${project.code} ${project.name}`} onClose={onClose} wide>
      <div className="form">
        {!supabase && (
          <div className="info-box">
            ฟีเจอร์นี้ต้องต่อฐานข้อมูลกลาง (Supabase) ก่อนถึงจะใช้ได้ — ตอนนี้ระบบทำงานแบบเก็บในเครื่องเท่านั้น
          </div>
        )}

        <FormDivider>อัปโหลดรูปใหม่</FormDivider>
        <div className="form-grid-3">
          <div className="form-row">
            <label>วันที่ถ่ายภาพ</label>
            <input type="date" value={takenAt} onChange={(e) => setTakenAt(e.target.value)} />
          </div>
          <div className="form-row">
            <label>คำอธิบายรูป (ไม่บังคับ — ใช้กับทุกรูปที่เลือกครั้งนี้)</label>
            <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="เช่น เทพื้นชั้น 1" />
          </div>
          <div className="form-row">
            <label>เลือกรูป (เลือกได้หลายรูปพร้อมกัน)</label>
            <input type="file" accept="image/*" multiple onChange={handleUpload} disabled={uploading || !supabase} />
          </div>
        </div>
        {uploading && <p className="field-hint">กำลังอัปโหลด… อย่าเพิ่งปิดหน้าต่างนี้</p>}
        {error && <p className="field-hint" style={{ color: "var(--maroon)" }}>{error}</p>}

        <FormDivider>รูปภาพทั้งหมดของโปรเจกต์นี้ ({photos.length} รูป)</FormDivider>
        {loading ? (
          <p className="muted">กำลังโหลด…</p>
        ) : groupKeys.length === 0 ? (
          <p className="muted">ยังไม่มีรูปภาพในโปรเจกต์นี้</p>
        ) : (
          groupKeys.map((key) => {
            const [year, month] = key.split("-");
            const monthLabel = THAI_MONTHS_SHORT[Number(month) - 1] || month;
            return (
              <div key={key} style={{ marginBottom: 18 }}>
                <p className="card-line" style={{ fontWeight: 700 }}>{monthLabel} {year}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {groups[key].map((p) => (
                    <a
                      key={p.id}
                      href={p.drive_url}
                      target="_blank"
                      rel="noreferrer"
                      className="unit-chip"
                      title={p.caption || p.taken_at}
                      style={{ textDecoration: "none" }}
                    >
                      🖼 {p.taken_at} {p.caption ? `— ${p.caption}` : ""}
                    </a>
                  ))}
                </div>
              </div>
            );
          })
        )}

        <div className="form-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </Modal>
  );
}
