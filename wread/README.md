# WRead — 轻量自托管电子书阅读器

基于 [Readest](https://github.com/readest/readest) 的轻量化私有化部署版本，仅替换底层依赖与数据存储逻辑，前端阅读界面、用户信息交互、书架视图完全保留原生代码。

## 改造要点

| 模块 | 原版 Readest | WRead 改造 |
|------|-------------|-----------|
| 数据库 | Supabase PostgreSQL | 本地 SQLite (better-sqlite3) |
| 鉴权 | GoTrue + Supabase Auth | 本地 JWT (jsonwebtoken + bcryptjs) |
| 对象存储 | MinIO / S3 / Cloudflare R2 | 本地文件系统 |
| 付费系统 | Stripe + Apple IAP + Google IAP | 已移除 |
| 翻译代理 | DeepL API + Cloudflare KV | LibreTranslate 本地代理 |
| 邮件收件 | Cloudflare Worker + Supabase | 已移除 |
| 用户注册 | 开放注册 + OAuth | 仅管理员账号，关闭自助注册 |
| Docker | 5 容器 (PG + Kong + GoTrue + PostgREST + MinIO) | 单容器 |

## 快速部署

### 1. Docker Compose (推荐)

```bash
# 克隆仓库并初始化子模块
git clone --recurse-submodules https://github.com/your-org/wread.git
cd wread

# 配置环境变量
cp docker/.env.example docker/.env
# 编辑 docker/.env，修改 WREAD_JWT_SECRET 和管理员密码

# 构建并启动
cd docker
docker compose up -d
```

访问 `http://localhost:3000`，使用 `docker/.env` 中配置的管理员账号登录。

### 2. 本地开发

```bash
# 安装依赖
pnpm install

# 配置环境
cp apps/wread-app/.env.example apps/wread-app/.env
# 编辑 .env 修改 WREAD_JWT_SECRET

# 初始化 vendor 文件
pnpm --filter @readest/readest-app setup-vendors

# 启动开发服务器
pnpm --filter @readest/readest-app dev-web
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `WREAD_DB_PATH` | SQLite 数据库文件路径 | `./data/wread.db` |
| `WREAD_STORAGE_PATH` | 文件存储目录 | `./data/storage` |
| `WREAD_JWT_SECRET` | JWT 签名密钥 (务必修改!) | 内置默认值 |
| `WREAD_JWT_EXPIRY` | JWT 过期时间 | `7d` |
| `WREAD_ADMIN_EMAIL` | 管理员邮箱 | `admin@wread.local` |
| `WREAD_ADMIN_PASSWORD` | 管理员初始密码 | `admin` |
| `STORAGE_FIXED_QUOTA` | 存储配额 (字节) | `10737418240` (10GB) |
| `TRANSLATION_FIXED_QUOTA` | 每日翻译配额 (字符数) | `500000` |
| `LIBRETRANSLATE_URL` | LibreTranslate 服务地址 | 空 (禁用) |
| `LIBRETRANSLATE_API_KEY` | LibreTranslate API Key | 空 |

## 数据持久化

Docker 部署时，两个目录需要挂载持久化卷：

- `/app/data` — SQLite 数据库文件
- `/app/data/storage` — 书籍文件、封面、头像

## 登录

WRead 默认关闭自助注册，仅支持管理员账号登录。首次启动时自动创建管理员账号。

如需添加新用户，可通过 API：

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-jwt-token>" \
  -d '{"email": "user@example.com", "password": "password123", "username": "username"}'
```

> 注意：注册 API 需要管理员 JWT 授权。

## 翻译功能

WRead 使用 LibreTranslate 替代 DeepL：

1. 部署 LibreTranslate 服务：
   ```bash
   docker run -d -p 5000:5000 libretranslate/libretranslate
   ```

2. 在 `.env` 中配置：
   ```
   LIBRETRANSLATE_URL=http://localhost:5000
   ```

## 文件说明

### 新增文件 (WRead 专有)

- `src/utils/wread-db/index.ts` — SQLite 数据库层，替代 Supabase
- `src/utils/wread-auth.ts` — JWT 鉴权模块，替代 GoTrue
- `src/utils/wread-storage.ts` — 本地文件存储，替代 S3/R2
- `src/utils/wread-init.ts` — 启动初始化模块
- `src/app/api/auth/login/route.ts` — 登录 API
- `src/app/api/auth/me/route.ts` — 用户信息 API
- `src/app/api/auth/profile/route.ts` — 用户资料更新 API
- `src/app/api/local-storage/download/route.ts` — 文件下载 API
- `src/app/api/local-storage/upload/route.ts` — 文件上传 API
- `src/app/api/libretranslate/translate/route.ts` — 翻译代理 API
- `src/app/api/storage/stats/route.ts` — 存储统计 API
- `src/app/api/user/delete/route.ts` — 账号删除 API

### 修改文件 (核心改造)

- `src/utils/supabase.ts` — 改为本地 JWT 认证兼容层
- `src/utils/access.ts` — validateUserAndToken 改用本地 JWT
- `src/utils/storage.ts` — 存储类型始终返回 'local'
- `src/services/runtimeConfig.ts` — 移除 Supabase 配置
- `src/context/AuthContext.tsx` — 适配本地 JWT User 类型
- `src/app/auth/page.tsx` — 替换为邮箱/密码登录表单
- `src/helpers/auth.ts` — 适配本地认证
- `src/pages/api/sync.ts` — 数据同步改用 SQLite
- `src/pages/api/storage/upload.ts` — 上传导流至本地存储
- `src/pages/api/storage/download.ts` — 下载导向本地存储
- `src/middleware.ts` — 移除 Cross-Origin 隔离需求
- `package.json` — 移除云端依赖，添加本地化依赖
- `next.config.mjs` — 添加 better-sqlite3 为外部包
- `Dockerfile` — 精简为单容器构建
- `docker/compose.yaml` — 单容器部署配置

## 许可证

基于 Readest 源码修改，遵循原项目许可证。
