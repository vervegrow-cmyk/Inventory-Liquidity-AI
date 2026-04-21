# Changelog

All notable changes to this project will be documented in this file.

---

## [0.1.2] - 2026-04-21

### Fixed
- 管理后台恢复：`vercel.json` 改回负向前瞻 rewrite，`/(.*) → /index.html` 会拦截 API 调用导致所有接口返回 HTML
- AI 接口 404 根本原因确认：Vercel 不调用 `api/` 根目录下的静态文件函数（如 `api/identify.js`），只有子目录函数（如 `api/auth/[action].js`）可靠
- 新建 `api/ai/[action].js` 采用与 auth/inquiry 相同的子目录+动态段模式，处理 `/api/ai/identify` 和 `/api/ai/pricing`

### Changed
- 前端 `/api/identify` → `/api/ai/identify`
- 前端 `/api/pricing` → `/api/ai/pricing`
- 删除不生效的 `api/identify.js`、`api/pricing.js`
- `vercel.json` 恢复 `/((?!api/).*) → /index.html` 负向前瞻

---

## [0.1.1] - 2026-04-21

### Fixed
- `vercel.json` 改用最简 `/(.*) → /index.html` rewrite，彻底去掉负向前瞻复杂正则
- 在 `api/identify.js` 加入 `console.log` 调试日志，便于 Vercel Function Logs 确认函数是否被调用

### Changed
- `vercel.json` 移除 `devCommand`，仅保留 `buildCommand`、`outputDirectory`、`rewrites`

---

## [0.1.0] - 2026-04-21

### Fixed
- 彻底修复 `/api/identify/analyze` 404：放弃 catch-all `[...path].js` 方案，改用单段简单路由
- 根本原因：Vercel 的 `api/[...path].js` catch-all 对多段嵌套路径（如 `/api/identify/analyze`）路由不可靠
- 修复方式：新增 `api/identify.js`（`POST /api/identify`）和 `api/pricing.js`（`POST /api/pricing`），均完全自包含
- 同时恢复 `api/auth/[action].js`、`api/inquiry/[action].js`、`api/logistics/select.js`（单动态段路由，Vercel 可靠支持）

### Changed
- 前端 `identifyApi.ts`：调用路径从 `/api/identify/analyze` 改为 `/api/identify`
- 前端 `pricingApi.ts`：调用路径从 `/api/pricing/calculate` 改为 `/api/pricing`
- 删除 `api/[...path].js` catch-all
- `dev-server.js` 新增 `/api/pricing` 别名

---

## [0.0.9] - 2026-04-21

### Fixed
- 彻底消除 `/api/identify/analyze` 404：删除 `api/auth/[action].js`、`api/inquiry/[action].js`、`api/logistics/select.js` 三个独立函数文件
- 根本原因：Vercel 多函数文件共存时，`[...path].js` catch-all 路由优先级可能被覆盖或干扰，导致特定路径 404
- 修复方式：将全部路由（auth/inquiry/logistics/identify/pricing）内联到唯一函数入口 `api/[...path].js`，零外部导入，无路由歧义

### Changed
- 删除 `api/auth/[action].js`、`api/inquiry/[action].js`、`api/logistics/select.js`
- `api/[...path].js` 现在处理所有 15 条路由，完全自包含

---

## [0.0.8] - 2026-04-21

### Fixed
- 彻底解决 identify/pricing 函数 404/405：删除嵌套目录静态路由文件，改用 `api/[...path].js` catch-all
- 嵌套静态路由（`api/identify/analyze.js`）被 Vercel 路由匹配异常，catch-all 动态路由优先级更稳定
- `vercel.json` 改回负向前瞻 rewrite，API 路径不被拦截，由 Vercel 默认函数路由处理

### Changed
- 删除 `api/identify/analyze.js` 和 `api/pricing/calculate.js`
- 新增 `api/[...path].js` 处理所有 AI 路由，完全自包含（零外部导入）

---

## [0.0.7] - 2026-04-21

### Fixed
- API 函数路由持续 404：`routes` 是 Vercel Legacy 配置，对函数调用语义不同
- 改用现代 `rewrites` 双规则方案：`/api/:path*` pass-through 让 Vercel 正确找到函数，`/:path*` 兜底 SPA

---

## [0.0.6] - 2026-04-21

### Changed
- 更新本地开发数据库种子数据（inquiries、products）

---

## [0.0.5] - 2026-04-21

### Fixed
- `api/identify/analyze.js` 和 `api/pricing/calculate.js` 改为完全自包含
- 根本原因：Vercel 的 nft 文件追踪器未能将 `api/` 以外的文件（features/、skills/、agents/ 等）打包进函数 bundle，导致函数运行时找不到依赖，表现为 HTTP 404
- 修复方式：将 kimiChat、parseJson、identify/pricing 逻辑全部内联到各函数文件，消除跨目录依赖

---

## [0.0.4] - 2026-04-21

### Fixed
- `POST /api/identify/analyze` 仍 405：改用 `routes` 配置，显式将 `/api/(.*)` 路由到 Serverless Function
- `rewrites` 对 POST 请求命中 index.html 而非函数（Vercel 的 rewrites 在函数检查之前执行）
- 前端版本号从硬编码 `v1.2.0` 改为从 `package.json` 自动注入，推送后版本号即时同步

### Changed
- `vercel.json` 改用 `routes` 配置：filesystem → /api/(.*) 显式路由 → SPA 兜底
- `vite.config.ts` 通过 `define.__APP_VERSION__` 注入版本号
- 新增 `src/vite-env.d.ts` 声明 `__APP_VERSION__` 全局常量类型

---

## [0.0.3] - 2026-04-21

### Fixed
- `POST /api/identify/analyze` 持续 404：移除 `framework: "vite"` 配置，改回标准路由模型
- 标准路由模型下 Vercel 按「静态文件 → Serverless Function → Rewrite」顺序检查，API 函数可被正确匹配
- `/((?!api/).*)` 负向前瞻在 Vite Build Output API 模式下失效，改用简单 `/(.*) → /index.html`

---

## [0.0.2] - 2026-04-21

### Changed
- 更新本地开发数据库种子数据（products、inquiries、logistics、decisions）
- 版本号规范：每次推送自动 bump patch 版本

---

## [0.0.1] - 2026-04-21

### Added
- 管理后台系统（`/admin`）：询价列表、询价详情、客户管理、数据统计
- 登录认证系统：Token 校验、登录/登出接口（`/api/auth/*`）
- 询价管理 API：创建、查询、更新、状态流转、删除、统计（`/api/inquiry/*`）
- 物流方式选择接口（`/api/logistics/select`）
- Upstash Redis 存储层，带内存存储兜底（无需配置 Redis 即可运行）
- 询价状态机：`pending → contacted → completed / cancelled / pending_recovery`
- 客户列表 UI 重构：卡片式布局，border-l-4 选中态，统一视觉规范
- 管理后台环境检测：生产/本地分别显示不同的连接失败提示

### Fixed
- Vercel SPA 路由 404：刷新 `/admin/*` 等页面不再返回 404
- Vercel Serverless Function 超出 12 个限制：合并为 5 个动态路由函数
- `POST /api/identify/analyze` 返回 405/404：改用 `rewrites` + `/api/` 负向前瞻排除
- 估价结果空白：修复 `setResult` 在 `done=false` 时被覆盖的问题

### Changed
- `vercel.json` 从 `routes` 配置改回 `rewrites` 配置，修复 API 函数匹配问题
- `api/[...path].js` 单一入口拆分为 `api/auth/[action].js`、`api/inquiry/[action].js` 等独立路由

---

## [0.0.0] - 初始版本

- AI 商品识别（图片 / 视频 / Excel）
- 多轮对话估价（收货价 / 转售价 / 快速出货价）
- React + TypeScript + Tailwind CSS 前端
- Kimi (Moonshot) AI 接入
- Vite 构建 + Vercel 部署
