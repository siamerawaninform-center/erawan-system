import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient.js";
import { STORAGE_KEY, EMPTY_DATA } from "./constants.js";
import { todayISO } from "./format.js";

/* ---------------------------------------------------------
   จัดการข้อมูลทั้งระบบ
   - ถ้าตั้งค่า Supabase ไว้ → ใช้ฐานข้อมูลกลาง (เรียลไทม์ทุกเครื่อง)
   - ถ้าไม่ได้ตั้ง → เก็บใน localStorage ของเบราว์เซอร์นั้น
--------------------------------------------------------- */

/** เติมคีย์ที่หายไปให้ครบ กันข้อมูลเก่าที่ยังไม่มีฟิลด์ใหม่ */
export function normalizeData(raw) {
  const out = { ...EMPTY_DATA };
  Object.keys(EMPTY_DATA).forEach((k) => {
    const v = raw?.[k];
    if (Array.isArray(EMPTY_DATA[k])) out[k] = Array.isArray(v) ? v : [];
    else out[k] = v && typeof v === "object" ? v : {};
  });
  return out;
}

export function useAppData() {
  const [data, setData] = useState(EMPTY_DATA);
  const [loaded, setLoaded] = useState(false);
  const [syncState, setSyncState] = useState(supabase ? "connecting" : "local");
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  /* ---------- โหลดข้อมูลครั้งแรก + subscribe realtime ---------- */
  useEffect(() => {
    let channel;

    function loadLocal() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) setData(normalizeData(JSON.parse(raw)));
      } catch (e) {
        /* ไม่มีข้อมูลเดิม — เริ่มจากว่าง */
      }
    }

    async function loadCloud() {
      try {
        const { data: row, error } = await supabase
          .from("app_state")
          .select("data")
          .eq("id", "main")
          .single();
        if (error) throw error;
        if (row?.data) setData(normalizeData(row.data));
        setSyncState("live");
      } catch (e) {
        setSyncState("error");
        // ถ้าต่อคลาวด์ไม่ได้ ใช้ข้อมูลในเครื่องไปก่อน ไม่ให้ระบบว่างเปล่า
        loadLocal();
      }
    }

    (async () => {
      if (supabase) {
        await loadCloud();
        channel = supabase
          .channel("app_state_changes")
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "app_state", filter: "id=eq.main" },
            (payload) => {
              if (payload.new?.data) setData(normalizeData(payload.new.data));
            }
          )
          .subscribe((status) => {
            if (status === "CHANNEL_ERROR") setSyncState("error");
          });
      } else {
        loadLocal();
      }
      setLoaded(true);
    })();

    return () => {
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, []);

  /* ---------- บันทึกข้อมูล ---------- */
  const persist = useCallback(
    async (next) => {
      setData(next);
      // เขียนสำเนาลง localStorage เสมอ เป็นตัวสำรองกันข้อมูลหาย
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        /* พื้นที่เต็มหรือถูกปิดกั้น — ข้ามไป */
      }
      if (!supabase) return;
      try {
        const { error } = await supabase
          .from("app_state")
          .upsert({ id: "main", data: next, updated_at: new Date().toISOString() });
        if (error) throw error;
        setSyncState("live");
        // เก็บสำเนาย้อนหลังไว้กู้คืนได้ — ไม่รอผลลัพธ์ ไม่ให้กระทบความเร็วตอนบันทึก
        supabase.from("app_state_history").insert({ data: next }).then(() => {});
      } catch (e) {
        setSyncState("error");
        showToast("บันทึกขึ้นฐานข้อมูลกลางไม่สำเร็จ — บันทึกไว้ในเครื่องนี้แล้ว");
      }
    },
    [showToast]
  );

  /* ---------- ตัวช่วย เพิ่ม/แก้/ลบ รายการในคอลเลกชัน ---------- */
  const upsert = useCallback(
    (key, item, label) => {
      const list = data[key] || [];
      const exists = list.some((x) => x.id === item.id);
      const nextList = exists ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
      persist({ ...data, [key]: nextList });
      if (label) showToast(exists ? `บันทึกการแก้ไข${label}แล้ว` : `เพิ่ม${label}แล้ว`);
    },
    [data, persist, showToast]
  );

  const remove = useCallback(
    (key, id, label) => {
      persist({ ...data, [key]: (data[key] || []).filter((x) => x.id !== id) });
      if (label) showToast(`ลบ${label}แล้ว`);
    },
    [data, persist, showToast]
  );

  /** ลบโปรเจกต์ พร้อมล้างข้อมูลที่ผูกอยู่ */
  const removeProject = useCallback(
    (id) => {
      persist({
        ...data,
        projects: data.projects.filter((p) => p.id !== id),
        documents: data.documents.filter((d) => d.projectId !== id),
        quotes: data.quotes.filter((q) => q.projectId !== id),
        expenses: data.expenses.filter((e) => e.projectId !== id),
        boqs: data.boqs.filter((b) => b.projectId !== id),
        plans: data.plans.filter((x) => x.projectId !== id),
        jsas: data.jsas.filter((x) => x.projectId !== id),
        team: data.team.map((t) => ({
          ...t,
          projectIds: (t.projectIds || []).filter((pid) => pid !== id),
        })),
      });
      showToast("ลบโปรเจกต์และข้อมูลที่เกี่ยวข้องแล้ว");
    },
    [data, persist, showToast]
  );

  const saveCompany = useCallback(
    (company) => {
      persist({ ...data, company });
      showToast("บันทึกข้อมูลบริษัทแล้ว");
    },
    [data, persist, showToast]
  );

  /* ---------- สำรอง / นำเข้าข้อมูล ---------- */
  const exportData = useCallback(() => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `siam-erawan-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("ดาวน์โหลดไฟล์สำรองข้อมูลแล้ว");
  }, [data, showToast]);

  const importData = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          if (!window.confirm("นำเข้าข้อมูลนี้จะแทนที่ข้อมูลปัจจุบันทั้งหมด ยืนยันหรือไม่?")) return;
          persist(normalizeData(parsed));
          showToast("นำเข้าข้อมูลสำเร็จ");
        } catch (err) {
          showToast("ไฟล์ไม่ถูกต้อง ไม่สามารถนำเข้าได้");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [persist, showToast]
  );

  return {
    data,
    loaded,
    syncState,
    toast,
    showToast,
    persist,
    upsert,
    remove,
    removeProject,
    saveCompany,
    exportData,
    importData,
  };
}
