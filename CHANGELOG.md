# Changelog

All notable changes to this project will be documented in this file.

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
