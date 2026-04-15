# Prompt: Migrasi Laravel → Next.js + Supabase

Paste prompt ini ke Claude Code di VS Code.
Pastikan workspace kamu sudah buka folder ROOT project (yang ada folder backend/ dan frontend/).

---

## PROMPT

Please read my entire codebase first before doing anything.

Start by exploring the full project structure:
- Read all files in `backend/` (Laravel) — routes, controllers, models, migrations, services
- Read all files in `frontend/` (Next.js) — pages, components, lib, api routes

After reading, give me a full summary of:
1. All features that are currently working in Laravel backend
2. All API endpoints that exist (`routes/api.php`)
3. All database tables and their structure (from migrations)
4. How the realtime (Laravel Reverb) is currently implemented
5. How Midtrans payment is currently handled
6. How auth (Sanctum) is currently working
7. What the Next.js frontend is currently consuming from the API

Then propose a detailed migration plan to move everything to:
- **Database**: Supabase (PostgreSQL) — replace MySQL
- **Auth**: Supabase Auth — replace Laravel Sanctum
- **Realtime**: Supabase Realtime — replace Laravel Reverb
- **API/Backend**: Next.js API Routes (`app/api/`) — replace Laravel controllers
- **Payment**: Keep Midtrans, but move webhook handler to Next.js API route
- **AI Questions**: Keep Gemini API, but call from Next.js API route

---

## Migration Rules (follow these strictly)

### 1. Database
- Convert all MySQL migrations to Supabase SQL (PostgreSQL syntax)
- Keep all table names and column names exactly the same
- Add Row Level Security (RLS) policies for user data protection
- `couple_id` convention stays: always `LEAST(user_id, partner_id)`

### 2. Auth
- Replace `auth:sanctum` middleware with Supabase Auth session check
- Use `@supabase/ssr` for server-side auth in Next.js App Router
- Protect all API routes with Supabase session validation

### 3. API Routes Structure
Move all Laravel controllers to Next.js API routes:
```
Laravel                          →  Next.js
app/Http/Controllers/Api/        →  app/api/
AuthController.php               →  app/api/auth/[...]/route.ts
CoupleController.php             →  app/api/couple/[...]/route.ts
CoinController.php               →  app/api/coin/[...]/route.ts
GameTodController.php            →  app/api/game/tod/[...]/route.ts
AnniversaryController.php        →  app/api/anniversaries/[...]/route.ts
```

### 4. Business Logic
- Move all Service classes logic into the corresponding API route handlers
- Keep the same validation rules
- Keep the same error response format: `{ success: bool, message: string, data: any }`
- All complex operations (deduct coin + create session) must use Supabase transactions

### 5. Realtime
- Replace Laravel Reverb channels with Supabase Realtime subscriptions
- Game session sync: subscribe to changes on `game_sessions` table filtered by `session_code`
- Use `supabase.channel()` on the client side (Next.js game page)

### 6. Midtrans
- Move webhook endpoint to `app/api/coin/webhook/route.ts`
- Keep the same signature verification logic
- After payment confirmed: update `coin_transactions.payment_status` + increment `wallets.balance`

### 7. Frontend
- Replace all `axios` calls to Laravel API with either:
  - Direct Supabase client queries (for simple CRUD)
  - `fetch('/api/...')` calls (for complex business logic)
- Replace all auth token handling with Supabase session
- Keep all existing UI components — do NOT redesign anything

---

## Tech Stack After Migration
```
Frontend + API  →  Next.js 14 (App Router) on Vercel
Database        →  Supabase (PostgreSQL)
Auth            →  Supabase Auth
Realtime        →  Supabase Realtime
Storage         →  Supabase Storage (for avatars)
Payment         →  Midtrans (webhook via Next.js API route)
AI              →  Gemini API (via Next.js API route)
```

## Packages to Install
```bash
npm install @supabase/supabase-js @supabase/ssr
npm install midtrans-client
npm install @google/generative-ai
```

---

## What NOT to change
- Do NOT change any UI/design/components
- Do NOT rename any table or column names
- Do NOT change any business rules (coin deduct logic, couple linking, etc.)
- Do NOT remove any existing features

---

## Delivery
After the migration plan is approved by me, execute it file by file.
Start with:
1. Supabase SQL schema (all tables + RLS policies)
2. Supabase client setup (`lib/supabase/`)
3. Auth migration
4. API routes one by one (start with auth, then coin, then game)
5. Update frontend to use new endpoints
6. Remove all Laravel dependencies from frontend

Ask me before starting each major step.