# 🚨 Open Issues & Blockers — Mangify

> **อัปเดตล่าสุด:** 2026-06-21

---

## 🔴 Critical (Blocking)

*(ไม่มีประเด็นติดขัดระดับวิกฤตในปัจจุบัน)*

---

## 🟢 Resolved (แก้ไขเสร็จสิ้นในรอบนี้)

### 1. Cloudflare Aggressive Blocking — doujin-lc.net
- **สถานะ:** RESOLVED ✅
- **อาการเดิม:** ตอนดึงข้อมูลหน้ารายการตอน (Chapter Pages) ของเรื่อง `moby-dick` และ `you-wont-get-me-twice` ถูกบล็อคด้วย Cloudflare JS Challenge (Attention Required!)
- **แนวทางแก้ไข:** 
  1. ออกแบบกระบวนการดึงข้อมูลตอนใหม่ด้วยสคริปต์ `scripts/scrape-chapters-direct.js`
  2. ยกเลิกพฤติกรรมการกดย้อนกลับ `page.goBack()` หรือคลิกจากหน้าหลัก `click()` ซึ่งเสี่ยงต่อการโดนจับพฤติกรรมผิดปกติ
  3. ใช้การเข้าถึง URL รายตอนโดยตรง (Direct Navigation) ผ่านแท็บที่สร้างขึ้นมาใหม่แยกกัน (`browser.newPage()`), สกัดข้อมูลภาพและบันทึกลง Supabase ทันที, จากนั้นจึงปิดแท็บและตั้งดีเลย์แบบสุ่ม 1.5 - 3 วินาที
  4. ผลลัพธ์: สามารถดึงข้อมูลหน้าตอนของ **Moby Dick (99 ตอน)** และ **You Won't Get Me Twice (26 ตอน)** สำเร็จครบถ้วน 100% อ่านจริงได้แล้ว

---

## 🟡 Medium (Non-blocking แต่ต้องแก้)

### 2. Cover Image Gaps
- **สถานะ:** PARTIALLY RESOLVED
- **อาการ:** บางเรื่องยังมี cover เป็น empty string หรือ null
- **แก้ไขแล้ว:** รัน `backfill-covers.js` — ซ่อมส่วนใหญ่ได้
- **ยังเหลือ:** ต้อง verify ว่ามังงะทุกเรื่องมี valid cover URL
- **Action:** รัน `check-db.js` เพื่อหา manga rows ที่ `cover IS NULL OR cover = ''`

### 3. Monolithic page.tsx
- **สถานะ:** KNOWN TECH DEBT
- **อาการ:** `page.tsx` มีขนาด 66KB+ — ทุก feature อยู่ในไฟล์เดียว
- **ผลกระทบ:** ยากต่อการ maintain, slow IDE autocomplete, potential bundle size issues
- **Action:** พิจารณา refactor แยก feature modules (reader, catalog, auth state)

### 4. Birth Date vs Birth Year Inconsistency
- **สถานะ:** NEEDS CLEANUP
- **อาการ:** มีทั้ง `birth_year` (INTEGER) และ `birth_date` (DATE?) ในฐานข้อมูล
- **ต้นเหตุ:** ออกแบบ birth_year ก่อน → User ต้องการ birth_date เต็มรูปแบบ → เพิ่มคอลัมน์แต่ยังไม่ได้ลบอันเก่า
- **Action:** ตัดสินใจว่าจะใช้ column ไหนเป็น canonical → migrate data → drop อันที่ไม่ใช้

---

## 🟢 Low (Nice to have)

### 5. Scraper Error Handling
- ไม่มี retry mechanism เมื่อ chapter page load fail
- ไม่มี report สรุปว่า chapter ไหนดึงสำเร็จ/ล้มเหลว

### 6. API Route Types
- API routes ยังไม่มี input validation (zod/yup)
- Error responses ยังไม่ standardized

---

## 🔗 Related Notes

- [[03 - Scraper & Data Pipeline]]
- [[05 - Session Work Log]]
- [[07 - Future Roadmap]]
