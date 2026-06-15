# WRead Work Log

---
Task ID: 1
Agent: main
Task: Clone Readest source code and analyze architecture

Work Log:
- Cloned Readest source from GitHub to /home/z/my-project/wread-source
- Analyzed project structure: monorepo with pnpm workspaces
- Identified all Supabase, S3, Stripe, GoTrue dependencies
- Mapped all API routes, auth pages, database schema
- Documented Docker compose configuration (5-container stack)

Stage Summary:
- Readest is a Next.js 16 + Tauri ebook reader
- Uses Supabase for auth+DB, S3/R2 for storage, Stripe for payments
- 1634+ source files need brand replacement
- Core modification targets identified: supabase.ts, access.ts, AuthContext.tsx, auth/page.tsx, sync.ts, storage APIs

---
Task ID: 2
Agent: main
Task: Global brand replacement Readest→WRead

Work Log:
- Created working copy at /home/z/my-project/wread
- Renamed apps/readest-app → apps/wread-app, apps/readest.koplugin → apps/wread.koplugin
- Global sed replacement: Readest→WRead, readest→wread across all source files
- Fixed case issues: WREAD→WREAD, Wread→WRead
- Preserved @readest/ package scope references (internal monorepo names)
- Updated pnpm-workspace.yaml directory references

Stage Summary:
- All user-facing brand references updated to WRead
- Package names preserved as @readest/* for monorepo compatibility

---
Task ID: 3-7
Agent: main
Task: Replace cloud dependencies with local alternatives, rewrite database/auth/storage/payment layers

Work Log:
- Created wread-db/index.ts: SQLite database layer with better-sqlite3
  - Tables: users, books, book_configs, book_notes, files, replicas, replica_keys, book_shares
  - CRUD operations aligned with original Supabase schema
  - WAL mode, foreign keys enabled
- Created wread-auth.ts: JWT authentication replacing GoTrue
  - loginWithEmail, registerUser, updateUserProfile, changePassword
  - validateUserAndToken drop-in replacement
  - toSupabaseCompatibleUser for frontend compatibility
  - ensureAdminUser for first-start admin creation
- Created wread-storage.ts: Local filesystem storage replacing S3/R2
  - localStorage.putObject/getObject/deleteObject/headObject/copyObject
  - generateFileKey/generateCoverKey/generateAvatarKey
  - Same interface as s3Storage/r2Storage
- Created wread-init.ts: Server startup initialization
- Rewrote supabase.ts as compatibility shim
  - supabase.auth.signInWithPassword → calls /api/auth/login
  - supabase.auth.onAuthStateChange → local event system
  - supabase.from() → stub (sync routes use wread-db directly)
- Rewrote access.ts: validateUserAndToken uses local JWT
- Rewrote AuthContext.tsx: WReadUser type, compatible with frontend
- Rewrote auth/page.tsx: Simple email/password login form (no OAuth, no Supabase Auth UI)
- Rewrote helpers/auth.ts: Adapted for local JWT
- Rewrote runtimeConfig.ts: WReadRuntimeConfig (no supabaseUrl/key)
- Rewrote storage.ts: Always returns 'local'
- Rewrote middleware.ts: Removed Cross-Origin isolation (no Turso WASM)
- Rewrote sync.ts: Uses wread-db directly instead of Supabase client
- Rewrote storage/upload.ts: Routes to local storage
- Rewrote storage/download.ts: Routes to local storage
- Created API routes:
  - /api/auth/login, /api/auth/me, /api/auth/profile, /api/auth/register
  - /api/local-storage/upload, /api/local-storage/download
  - /api/storage/stats, /api/user/delete
  - /api/libretranslate/translate
- Updated package.json:
  - Removed: @supabase/supabase-js, @supabase/auth-ui-react, @supabase/auth-ui-shared
  - Removed: @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, aws4fetch
  - Removed: @stripe/react-stripe-js, @stripe/stripe-js, stripe
  - Removed: app-store-server-api, google-auth-library, googleapis, posthog-js
  - Added: better-sqlite3, bcryptjs, jsonwebtoken, multer
  - Added types: @types/better-sqlite3, @types/bcryptjs, @types/jsonwebtoken, @types/multer
- Updated next.config.mjs: serverExternalPackages includes better-sqlite3, bcryptjs

Stage Summary:
- All cloud dependencies replaced with local alternatives
- Frontend user pages, reader, library views preserved
- Auth flow: email/password → local JWT → same token format as Supabase
- Database: SQLite single file, schema aligned with original
- Storage: Local filesystem with same API interface
- Payments: Completely removed

---
Task ID: 8-9
Agent: main
Task: Translation proxy and registration controls

Work Log:
- Created /api/libretranslate/translate route
  - Proxies to self-hosted LibreTranslate
  - Daily quota tracking per user (in-memory)
  - Translation caching (24h TTL)
- Created /api/auth/register route
  - Self-registration disabled by default (WREAD_ALLOW_SELF_REGISTER=true to enable)
  - Admin can create users via API with JWT authorization
  - Email/password validation

Stage Summary:
- LibreTranslate replaces DeepL for self-hosted translation
- Registration closed by default, admin-only user creation

---
Task ID: 10
Agent: main
Task: Docker deployment configuration

Work Log:
- Rewrote Dockerfile for single-container build
  - Multi-stage: dependencies → development-stage → build → production-stage
  - Creates /app/data and /app/data/storage directories
  - References apps/wread-app
- Rewrote docker/compose.yaml for single wread service
  - Two persistent volumes: wread-db (/app/data), wread-storage (/app/data/storage)
  - All config via environment variables
  - Health check
- Created docker/.env.example with all WRead-specific variables
- Rewrote apps/wread-app/.env with WRead configuration
- Updated apps/wread-app/.env.web (just NEXT_PUBLIC_APP_PLATFORM=web)

Stage Summary:
- Docker: Single container, 2 volumes, ~12 env vars
- No Nginx, no Kong, no GoTrue, no PostgREST, no MinIO, no PostgreSQL
- From 5 containers → 1 container

---
Task ID: prompt-update
Agent: main
Task: Update all UI prompts and i18n translations for the Wread fork

Work Log:
- Replaced all "Readest" → "WRead" in 34 main app translation.json files (1124 changes)
- Replaced all "Readest" → "WRead" in 33 koplugin translation.po files (1451 changes)
- Replaced all "Readest" → "WRead" in 34 extension src/locales/*.json files
- Replaced all "Readest" → "WRead" in 34 extension _locales/*/messages.json files
- Added "Unlimited" translation key to all 34 locales (无限/無限/Unlimited/etc.)
- Added "{{used}} / Unlimited" translation key to all 34 locales
- Added "Unlimited Cloud Sync Space" translation key to all 34 locales
- Added "Unlimited Daily Translation Characters" translation key to all 34 locales
- Updated Quota.tsx component: when quota.total === 0, shows "{{used}} / 无限" instead of "0 / 0"
- Updated useQuotaStats.ts: handles unlimited quota (0) for storage and translation, shows appropriate tooltips
- Updated StorageManager.tsx: shows "无限" for quota when 0, hides progress bar for unlimited plans

Stage Summary:
- All i18n files across 34 locales updated from Readest→WRead
- Storage quota of 0 now displays as "无限" (Unlimited) for VIP users
- New translation keys added for unlimited quota display
- No remaining "Readest" references in any translation files or UI text
