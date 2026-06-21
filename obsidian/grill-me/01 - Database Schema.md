# 🗄️ Database Schema — Mangify

> **Database:** Supabase (PostgreSQL)
> **Schema File:** `supabase/schema.sql`
> **Migration Scripts:** `supabase/*.sql` + `scripts/run-migrations.js`

---

## 📊 ER Diagram

```mermaid
erDiagram
    MANGA ||--|{ CHAPTERS : "contains"
    PROFILES ||--o{ BOOKMARKS : "has"
    PROFILES ||--o{ READING_PROGRESS : "has"
    MANGA ||--o{ BOOKMARKS : "bookmarked"
    MANGA ||--o{ READING_PROGRESS : "tracks"
    CHAPTERS ||--o{ READING_PROGRESS : "tracks"
    
    MANGA {
        text id PK "Slug name"
        text title
        text author
        text cover
        text description
        text_array genres
        boolean is_original
        boolean is_mature
        integer popularity
        text original_title
        text artist
        text status
        text manga_type
        integer release_year
        text views_count
        timestamp created_at
    }

    CHAPTERS {
        text id PK
        text manga_id FK
        text title
        text release_date
        text_array pages "Array of image URLs"
        timestamp created_at
    }

    PROFILES {
        uuid id PK "References auth.users"
        integer birth_year
        text_array favorite_genres
        text preferred_theme
        timestamp updated_at
    }
    
    BOOKMARKS {
        bigint id PK
        text user_id
        text manga_id FK
        timestamp created_at
    }
    
    READING_PROGRESS {
        bigint id PK
        text user_id
        text manga_id FK
        text chapter_id FK
        integer page_index
        float scroll_percent
        timestamp updated_at
    }

    ACTIVITY_LOGS {
        bigint id PK
        text user_id
        text event_type
        jsonb metadata
        timestamp created_at
    }
```

---

## 🔐 Row Level Security (RLS)

| ตาราง | SELECT | INSERT | UPDATE | DELETE |
| :--- | :--- | :--- | :--- | :--- |
| `manga` | ✅ Public | ❌ | ❌ | ❌ |
| `chapters` | ✅ Public | ❌ | ❌ | ❌ |
| `profiles` | ✅ Public | ❌ (trigger) | ✅ Owner only | ❌ |
| `bookmarks` | ✅ Owner only | ✅ Owner only | ❌ | ✅ Owner only |
| `reading_progress` | ✅ Owner only | ✅ Owner only | ✅ Owner only | ✅ Owner only |
| `activity_logs` | ✅ Owner only | ✅ Owner only | ❌ | ❌ |

---

## 📝 Migration Files

| ไฟล์ | คำอธิบาย |
| :--- | :--- |
| `supabase/schema.sql` | Schema หลัก — สร้างตาราง, index, RLS, trigger |
| `supabase/add_birth_date.sql` | เพิ่มคอลัมน์ `birth_date` ใน profiles |
| `supabase/add_mature_content_and_birth_year.sql` | เพิ่ม `is_mature` ใน manga, `birth_year` ใน profiles |
| `supabase/profiles_preferences_migration.sql` | เพิ่ม `favorite_genres`, `preferred_theme` |
| `supabase/profiles_2fa_migration.sql` | เพิ่มระบบ 2FA |

---

## 🔄 Auto-Trigger

เมื่อ User ใหม่ Sign Up → Trigger `handle_new_user()` จะสร้าง Row ใน `profiles` อัตโนมัติ พร้อมก๊อปปี้ค่า `birth_year` จาก `raw_user_meta_data`

---

## 🔗 Related Notes

- [[00 - Mangify Project Overview]]
- [[04 - Authentication & Age Gate]]
