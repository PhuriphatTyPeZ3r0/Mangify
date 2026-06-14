# Supabase Database Implementation Plan

This plan details the database schema (PostgreSQL) and the Next.js API endpoints (BFF) to handle bookmarks and reading progress syncing using a hybrid anonymous/authenticated architecture.

---

## 🏗️ PostgreSQL Database Schema

```mermaid
erDiagram
    PROFILES ||--o{ BOOKMARKS : "has"
    PROFILES ||--o{ READING_PROGRESS : "has"
    
    PROFILES {
        uuid id PK "References auth.users.id"
        timestamp updated_at
    }
    
    BOOKMARKS {
        bigint id PK
        text user_id "UUID or Anonymous Device ID"
        text manga_id "Manga Identifier"
        timestamp created_at
    }
    
    READING_PROGRESS {
        bigint id PK
        text user_id "UUID or Anonymous Device ID"
        text manga_id
        text chapter_id
        integer page_index
        float scroll_percent
        timestamp updated_at
    }
```

### 1. Table: `profiles`
Holds authenticated user metadata. Linked 1:1 with Supabase Auth.
- `id` (UUID, Primary Key, references `auth.users`)
- `updated_at` (Timestamp with timezone)

### 2. Table: `bookmarks`
Track manga bookmarks for both registered users (UUID) and anonymous users (Device ID).
- `id` (BigInt, Identity, Primary Key)
- `user_id` (Text, Indexed) - Can be UUID or LocalStorage Device UUID.
- `manga_id` (Text, Indexed)
- `created_at` (Timestamp with timezone)

### 3. Table: `reading_progress`
Track scroll percent and active pages.
- `id` (BigInt, Identity, Primary Key)
- `user_id` (Text, Indexed)
- `manga_id` (Text)
- `chapter_id` (Text)
- `page_index` (Integer)
- `scroll_percent` (Float/Numeric)
- `updated_at` (Timestamp with timezone)

---

## 📡 API Endpoints (BFF)

We will implement Next.js API Routes in `src/app/api/` to handle operations:

### 1. `/api/sync/progress` (`POST`)
Receives throttled client updates. Performs an `upsert` matching `(user_id, manga_id)` to update chapter, page, and scroll progress.
```json
{
  "userId": "anon-device-uuid-1234",
  "mangaId": "webtoon-character-kang-lim",
  "chapterId": "kanglim-ch15",
  "pageIndex": 0,
  "scrollPercent": 45.2
}
```

### 2. `/api/sync/bookmarks` (`GET`, `POST`, `DELETE`)
Manages user bookmarks.
- `GET`: Retrieve all bookmarks for a specific `userId`.
- `POST`: Add a bookmark.
- `DELETE`: Remove a bookmark.

---

## 🛠️ Implementation Steps

1. **Install Supabase Client SDK**: `npm install @supabase/supabase-js`.
2. **Database SQL Script**: Create `supabase/schema.sql` with tables, indices, triggers, and Row Level Security (RLS) policies.
3. **BFF Clients Setup**: Create `src/lib/supabaseClient.ts` using standard `process.env.NEXT_PUBLIC_SUPABASE_URL` and `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. **API Routes**: Write App Router Route Handlers.
5. **Frontend Client Integration**: Attach the throttled sync routine to the manga reader window.
