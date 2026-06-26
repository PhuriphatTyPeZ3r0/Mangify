# 📋 Session Work Log — 2026-06-21

> **Session Date:** 2026-06-21
> **Focus:** Database migration, Scraper optimization, Data repair, Age-gate security, OTP refactoring, Genre Auto-translation, Log-Based Metrics, Popularity Score Ranking, Scheduled Ingestion Pipeline, Production Deployment Preparation, UI Layout Optimization

---

## ✅ งานที่เสร็จสมบูรณ์

### 1. Database Migration & Setup
- [x] ตั้งค่า `SUPABASE_CONNECTION_STRING` ใน `.env.local`
- [x] รัน `npm run migrate` สำเร็จ
- [x] เพิ่ม `birth_date` column ใน profiles
- [x] เพิ่ม `is_mature` column ใน manga
- [x] เพิ่ม `birth_year` column ใน profiles
- [x] เพิ่ม `favorite_genres` + `preferred_theme` columns ใน profiles

### 2. User Profile System
- [x] ปรับ `ProfilePortal.tsx` ให้ user แก้ไขข้อมูลตัวเองได้
- [x] เปลี่ยนจากกรอก "อายุ" เป็นกรอก "วัน/เดือน/ปีเกิด"
- [x] Sync favorite genres + theme preferences ขึ้น Supabase

### 3. Scraper (doujin-lc.net)
- [x] สร้าง `scrape-doujin-lc.js` สำหรับ H-Manhwa genre
- [x] ติดตั้ง `puppeteer-extra` + `stealth` plugin
- [x] Decouple I/O: Pre-fetch existing → scrape → Bulk upsert
- [x] แก้ cover extraction logic (กรอง base64 SVG placeholders)
- [x] ทดสอบ chapter navigation หลายรูปแบบ

### 4. Data Repair & Cleansing
- [x] รัน `clean-db-genres.js` — แปลหมวดหมู่ EN→TH (10 เรื่อง)
- [x] รัน `backfill-covers.js` — ซ่อม cover URLs
- [x] รัน `fix-title.js` — แก้ title "Sorry, you have been blocked" → ชื่อจริง
- [x] Verify data ด้วย `analyze-data.js` + `check-db.js`

### 5. Age-Gate Security (18+ Access Control)
- [x] ซ่อนมังงะ 18+ จาก API แคตตาล็อกสำหรับ Guest และผู้ใช้อายุต่ำกว่า 18 ปี
- [x] เสริมความปลอดภัยขั้นสูงสุดระดับ BFF API `/api/chapters?id=...` โดยเช็คสิทธิ์และอายุ (18+) ก่อนอนุญาตให้ดึงข้อมูลหน้ารายอ่านการ์ตูน
- [x] อัปเดต Client-side logic ให้ส่ง `Authorization` header ไปกับคำขอดึงหน้า chapter
- [x] อัปเดตให้หน้าแรกทำการรีโหลดและเช็คแคตตาล็อกใหม่ทันทีเมื่อเกิดเหตุการณ์ Login/Logout หรือเมื่อผู้ใช้อัปเดตวันเกิดในโปรไฟล์

### 6. OTP UI/UX Refactoring (Digi 6-digit Standard)
- [x] ออกแบบและเขียนคอมโพเนนต์ `OtpInput.tsx` สำหรับกล่องกรอกรหัสตัวเลข 6 ช่องแยกจากกัน สนับสนุนการ Focus ถัดไปอัตโนมัติ การกดลบย้อนกลับ (Backspace back-focus) และการรองรับคีย์บอร์ดตัวเลขบนสมาร์ทโฟน
- [x] เปลี่ยนรูปแบบการล็อกอิน 2FA บนหน้าเว็บให้เป็นระบบกล่อง OTP 6 ช่อง
- [x] เปลี่ยนรูปแบบการตั้งค่า 2FA บนหน้าโปรไฟล์ส่วนตัวให้เป็นระบบกล่อง OTP 6 ช่อง
- [x] พัฒนาระบบยืนยันตัวตนอัตโนมัติ (Auto-Submit) เมื่อผู้ใช้กรอกตัวเลขครบทั้ง 6 หลักเพื่อ UX ที่รวดเร็ว

### 7. Automated Genre Cleansing & translation
- [x] พัฒนาระบบ `cleanGenresAsync` ใน `src/lib/genreUtils.js` ที่ผสานการล้าง prefix คำฟุ่มเฟือย และเชื่อมต่อกับ Google Translate API (Free endpoint) แปลหมวดหมู่จากภาษาอังกฤษเป็นภาษาไทยทันทีหากพบหมวดหมู่ใหม่ที่ไม่อยู่ใน Dictionary เดิม
- [x] อัปเกรดสคริปต์สแครปเปอร์ทั้งสองตัว (`scrape-doujin-lc.js`, `scrape-up-manga.js`) และสคริปต์ล้างฐานข้อมูล (`clean-db-genres.js`) ให้เปลี่ยนมาใช้ `cleanGenresAsync` เพื่อจัดการข้อมูลหมวดหมู่ทั้งหมด

### 8. UI Bug Fixes & Layout Optimization
- [x] แก้ Console Error: "empty string passed to src attribute"
  - `LibraryGrid.tsx` — เพิ่ม null check ก่อน render `<img>`
  - `page.tsx` — เพิ่ม placeholder fallback
  - `MangaInfoModal.tsx` — เพิ่ม null check
- [x] ปรับลดการแสดงผลปุ่ม "ล้างประวัติทั้งหมด" บนหน้าแสดงรายการประวัติอ่านล่าสุด โดยซ่อนส่วนข้อความตัวอักษรและคงเหลือไว้เฉพาะไอคอนถังขยะสีแดงเมื่อแสดงผลบนหน้าจอโทรศัพท์มือถือ/สมาร์ทโฟนขนาดเล็ก (`hidden sm:inline`) เพื่อรักษาความเป็นระเบียบและป้องกันปัญหาปุ่มล้นเบียดองค์ประกอบอื่น

### 9. Log-Based Metrics (Views & Bookmarks)
- [x] เปลี่ยนการดึงข้อมูลสถิติผู้เข้าชม (`realViews`) และจำนวนการบันทึก (`realBookmarks`) ของแคตตาล็อก API (`/api/catalog`) โดยคำนวณและประมวลผลจากข้อมูลดิบในตาราง `activity_logs` แทนตารางบันทึกสถานะเดิม:
  - **ผู้ชมจริง (realViews):** นับจากจำนวนผู้เข้าใช้ที่ไม่ซ้ำ (Unique Users) ที่เคยมีเหตุการณ์อ่านตอนการ์ตูน `chapter_read` ในตารางล็อก
  - **การบันทึกโปรด (realBookmarks):** นับแบบประเมินประวัติล่าสุด (Latest State) ของการ `bookmark_toggle` (`add`/`remove`) ของผู้ใช้แต่ละราย เพื่อให้ได้ตัวเลัปเดตปัจจุบัน
- [x] ปรับแก้วิธีแสดงผลตัวเลขผู้ชมจริงและยอดบันทึกจริงบนหน้าต่างรายละเอียด [MangaInfoModal.tsx](file:///C:/1_Projects/01_Active_Projects/Mangify/src/components/MangaInfoModal.tsx) ให้สะท้อนค่าจริงจาก Database
- [x] พัฒนาและอัปเกรดสูตรคำนวณคะแนนความนิยม `getMangaScore` ใน [page.tsx](file:///C:/1_Projects/01_Active_Projects/Mangify/src/app/page.tsx) เพื่อให้ผลรวมของการจัดอันดับและระบบแนะนำอิงจากข้อมูลการใช้งานจริงใน Database (`realViews` และ `realBookmarks`) เป็นหลักการันตีว่าการอ่านจริง/บันทึกจริงจะอยู่เหนือข้อมูล Static ที่สแครปมาเสมอ

### 10. Scheduled Ingestion Pipeline Update
- [x] ปรับปรุงไฟล์เวิร์กโฟลว์ของ GitHub Actions (`.github/workflows/ingest.yml`) สำหรับกระบวนการตั้งเวลาดึงข้อมูลใหม่ (Scheduled Manga Ingestion) โดยนำสคริปต์สแครปเปอร์มังงะผู้ใหญ่ 18+ (`scripts/scrape-doujin-lc.js`) เข้าร่วมกระบวนการรันอัตโนมัติร่วมกันในทุกๆ 6 ชั่วโมง พร้อมทั้งกำหนดคีย์ `continue-on-error: true` ในการสแครปของแต่ละแหล่งเพื่อรักษาความต่อเนื่องการดึงข้อมูลของระบบ

### 11. Production Deployment Preparation (Git Flow)
- [x] ทำการรันและตรวจสอบการสร้าง Bundle หน้าบ้านผ่าน `npm run build` ตรวจสอบความสมบูรณ์สำเร็จ 100%
- [x] ทำการ Stage และ Commit โค้ดที่มีการเปลี่ยนแปลงทั้งหมดบน branch `dev` และสั่ง Push ขึ้น GitHub (`origin/dev`)
- [x] สลับสาขาการทำงานไปยัง branch `master` เพื่อรวบรวมโค้ดใหม่ (Merge `dev` into `master`) และ Push ขึ้นสู่ branch หลักในการ Deploy ของระบบจริง (`origin/master`) เรียบร้อยสมบูรณ์ พร้อมตรวจสอบความพร้อมการจัดส่ง

---

## 📝 Key Decisions Made

1. **Server-Side API Security:** การซ่อนมังงะ 18+ บนหน้าบ้านไม่เพียงพอ จึงจำเป็นต้องล็อกระดับ BFF `/api/chapters` เพื่อป้องกันการเข้าถึงตรงผ่าน URL
2. **Auto-Submit OTP:** การกรอกตัวเลขครบ 6 ช่องแล้วระบบส่งข้อมูลทันทีให้ประสบการณ์ที่ดีและลื่นไหลกว่าการต้องเอื้อมไปกดปุ่ม Submit อีกรอบ
3. **Async Genre Pipeline with Fetch Fallback:** เพื่อให้ระบบยืดหยุ่นและรองรับหมวดหมู่ภาษาอังกฤษใหม่ๆ ได้ทันทีโดยไม่ต้องแก้โค้ดเพิ่ม จึงใช้ Google Translate API (Free endpoint) มาเป็นระบบแปลภาษาอัตโนมัติสำรอง
4. **Log-Based Source of Truth:** เปลี่ยนผ่านระบบชี้วัด (Metrics Source) ของแคตตาล็อกมาใช้ประวัติของตาราง `activity_logs` เสมือนเป็น Transaction log เพื่อรับทราบกิจกรรมที่เกิดขึ้นจริงของผู้ใช้และคำนวณย้อนกลับเป็นสถานะแบบ Real-time
5. **Database-Driven Popularity Formula:** ปรับเกลี่ยสัดส่วนสมการโดยให้คะแนนความนิยมมีสิทธิ์ในการใช้งานจริงในระบบ (Database interaction) คลุมสิทธิ์ Static score ทั้งหมด ซึ่งทำให้ตารางจัดอันดับ (Ranking Tab) ถูกกำหนดทิศทางด้วยผู้เข้าชมจริงในเว็บไซต์ Mangify
6. **Robust Sequential Scraper Actions:** จัดวางการรันสแครปเปอร์เรียงลำดับต่อเนื่องใน GitHub Actions workflow เดียวกันเพื่อให้ทรัพยากรการคำนวณมีประสิทธิภาพสูงสุด และลดผลกระทบของการทำงานล้มเหลวของตัวใดตัวหนึ่งด้วยตัวเลือกละเว้นข้อผิดพลาด
7. **Clean Staging Flow:** นำส่งโค้ดผ่านสาขา `dev` ก่อนการ Merge เข้าสู่ `master` เพื่อความเสถียรและความปลอดภัยก่อนที่ Vercel Production Build จะทริกเกอร์ตามระบบ CI/CD
8. **Responsive UI Optimization:** การสลับรูปแบบปุ่มลบประวัติบนมือถือให้เหลือเพียงไอคอนช่วยแก้ปัญหา UI เบียดเสียดบนหน้าจอขนาดเล็กและประหยัดพื้นที่แสดงผลได้อย่างมาก

---

## 🔗 Related Notes

- [[03 - Scraper & Data Pipeline]]
- [[04 - Authentication & Age Gate]]
- [[06 - Open Issues & Blockers]]
