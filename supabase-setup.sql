-- รันสคริปต์นี้ทั้งหมดในหน้า Supabase: SQL Editor → New query → วางแล้วกด Run
-- สร้างตารางเดียวที่เก็บข้อมูลทั้งระบบ (โปรเจกต์/เอกสาร/ใบเสนอราคา/ทีมงาน)
-- เป็น JSON ก้อนเดียว พร้อมเปิด Realtime ให้ทุกอุปกรณ์เห็นข้อมูลอัปเดตพร้อมกัน

create table if not exists app_state (
  id text primary key default 'main',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- แถวเริ่มต้น (ต้องมีแถวนี้อยู่ก่อน ระบบจึงจะโหลดข้อมูลได้ครั้งแรก)
insert into app_state (id, data)
values ('main', '{"projects":[],"documents":[],"quotes":[],"team":[]}'::jsonb)
on conflict (id) do nothing;

-- เปิดใช้ Row Level Security
alter table app_state enable row level security;

-- อนุญาตให้อ่าน/เขียนได้แบบไม่ต้องล็อกอิน (เหมาะกับทีมเล็กใช้ภายใน ไม่มีระบบสมาชิก)
-- ⚠️ หมายเหตุด้านความปลอดภัย: ใครก็ตามที่มีลิงก์เว็บนี้จะแก้ไขข้อมูลได้ทั้งหมด
-- ถ้าต้องการจำกัดสิทธิ์ ให้แจ้งเพื่อเพิ่มระบบล็อกอินภายหลังได้
create policy "allow anon read" on app_state
  for select using (true);

create policy "allow anon insert" on app_state
  for insert with check (true);

create policy "allow anon update" on app_state
  for update using (true);

-- เปิด Realtime ให้ตารางนี้ (ทำให้ข้อมูลอัปเดตแบบเรียลไทม์ข้ามอุปกรณ์)
alter publication supabase_realtime add table app_state;
