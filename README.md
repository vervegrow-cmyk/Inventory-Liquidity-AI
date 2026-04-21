# Inventory Liquidity AI

> AI 驱动的库存估价工具，专为清仓、滞销、二手、闲置商品设计。

![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite_8-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Version](https://img.shields.io/badge/version-0.0.1-brightgreen?style=flat-square)

---

## 功能概览

### 前台：AI 估价

上传商品图片、视频或 Excel 表格，AI 自动识别后通过多轮对话了解商品详情，输出三维估价结果。

| 估价维度 | 说明 |
|----------|------|
| 收货价 | 建议收购入手价格 |
| 转售价 | 正常渠道转卖的预期价格 |
| 快速出货价 | 需要快速变现时的建议价格 |

**支持的输入格式：**

- 图片：JPG / PNG（最大 10 MB）
- 视频：MP4 / MOV（自动提取关键帧）
- 表格：XLSX / CSV（批量选品，支持嵌入图片提取）

### 后台：询价管理系统

管理员后台（`/admin`）提供完整的询价订单管理：

| 功能 | 说明 |
|------|------|
| 询价列表 | 查看所有询价记录，支持状态筛选和搜索 |
| 询价详情 | 查看完整商品信息、估价结果、物流信息 |
| 状态管理 | 待处理 → 已联系 → 已完成 / 已取消 流转 |
| 客户管理 | 按客户聚合询价历史，统计交易金额 |
| 数据统计 | 询价量、完成率、平均金额等核心指标 |

---

## 快速开始

### 1. 克隆 & 安装

```bash
git clone https://github.com/vervegrow-cmyk/Inventory-Liquidity-AI.git
cd Inventory-Liquidity-AI
npm install
```

### 2. 配置环境变量

```bash
# 创建 .env 文件
KIMI_API_KEY=你的_Kimi_API_Key

# 可选：持久化存储（不配置则使用内存存储，重启后数据重置）
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
```

> 获取 Kimi API Key：[platform.moonshot.cn](https://platform.moonshot.cn) → API Keys

### 3. 启动

```bash
npm run dev
```

- 前端：[http://localhost:5173](http://localhost:5173)
- 后台：[http://localhost:5173/admin](http://localhost:5173/admin)（账号 `admin` / `123456`）
- API：[http://localhost:3001](http://localhost:3001)

---

## 项目结构

```
Inventory-Liquidity-AI/
│
├── skills/                     # AI 能力层（原子操作）
│   ├── kimiClient.js           #   Kimi API 基础调用封装
│   ├── kimiVision.js           #   图像 / 文本商品识别
│   └── kimiGenerate.js         #   自由内容生成
│
├── agents/                     # AI 流程编排层
│   ├── pricingAgent.js         #   多轮定价对话流程
│   └── identifyAgent.js        #   识别任务分发
│
├── features/                   # 业务模块（controller + service）
│   ├── pricing/
│   ├── identify/
│   ├── inquiry/
│   ├── auth/
│   ├── generate/
│   └── recovery/
│
├── api/                        # Vercel Serverless Functions
│   ├── _lib/
│   │   └── upstash.js          #   Redis / 内存存储适配层
│   ├── _handlers/
│   │   ├── auth.js             #   登录 / 登出 / 验证
│   │   ├── inquiry.js          #   询价 CRUD + 物流
│   │   └── ai.js               #   AI 识别 / 定价
│   ├── auth/[action].js        #   → login, logout, verify, register
│   ├── inquiry/[action].js     #   → create, list, get, update, update-status, delete, statistics
│   ├── logistics/select.js     #   物流方式选择
│   ├── pricing/calculate.js    #   AI 定价
│   └── identify/analyze.js     #   AI 识别
│
├── dev-server.js               # 本地开发 HTTP 服务器
│
└── src/                        # 前端（React + TypeScript）
    ├── modules/
    │   ├── admin/              #   后台管理页面
    │   │   ├── AdminLayout.tsx
    │   │   ├── AdminDashboard.tsx
    │   │   ├── InquiryListPage.tsx
    │   │   ├── InquiryDetailPage.tsx
    │   │   ├── CustomersPage.tsx
    │   │   └── LoginPage.tsx
    │   ├── auth/
    │   └── inquiry/
    ├── services/
    │   ├── authApi.ts
    │   ├── inquiryApi.ts
    │   ├── pricingApi.ts
    │   └── identifyApi.ts
    ├── stores/
    │   ├── authStore.ts
    │   └── notesStore.ts
    └── App.tsx
```

---

## API 参考

所有接口统一返回格式：

```json
{ "success": true, "data": {}, "message": "ok" }
{ "success": false, "error": { "code": "ERROR_CODE", "message": "描述" } }
```

### AI 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/identify/analyze` | 商品识别（图片 / 文本） |
| POST | `/api/pricing/calculate` | 多轮定价对话 |

### 询价接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/inquiry/create` | 创建询价 |
| POST | `/api/inquiry/list` | 获取询价列表 |
| POST | `/api/inquiry/get` | 获取询价详情 |
| POST | `/api/inquiry/update` | 更新询价信息 |
| POST | `/api/inquiry/update-status` | 更新询价状态 |
| POST | `/api/inquiry/delete` | 删除询价 |
| POST | `/api/inquiry/statistics` | 统计数据 |
| POST | `/api/logistics/select` | 物流方式选择 |

### 认证接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录 |
| POST | `/api/auth/logout` | 登出 |
| POST | `/api/auth/verify` | 验证 Token |

---

## 部署

### Vercel（推荐）

1. 推送代码到 GitHub
2. 在 [vercel.com](https://vercel.com) 导入仓库
3. 添加环境变量 `KIMI_API_KEY`
4. 点击部署

> 详细步骤见 [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)

### 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `KIMI_API_KEY` | 是 | Moonshot AI API Key |
| `UPSTASH_REDIS_REST_URL` | 否 | 持久化存储（不填则用内存） |
| `UPSTASH_REDIS_REST_TOKEN` | 否 | 持久化存储 Token |

---

## 可用命令

```bash
npm run dev      # 启动开发服务器（前端 :5173 + API :3001）
npm run build    # TypeScript 编译 + Vite 构建
npm run preview  # 预览生产构建
npm run lint     # ESLint 检查
```

---

## 安全说明

- `.env` 已加入 `.gitignore`，API Key 不会提交到仓库
- 所有 AI 调用在服务端执行，Key 不暴露到前端
- 管理后台需要登录验证，默认账号 `admin` / `123456`（生产环境请修改）

---

## License

MIT
