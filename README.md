# 📦 Inventory Liquidity AI

> AI 驱动的库存估价工具，专为清仓、滞销、二手、闲置商品设计。

---

## ✨ 功能介绍

上传一张商品图片，AI 自动识别商品信息，然后通过多轮对话了解商品详情，最终给出专业的三维估价：

| 估价维度 | 说明 |
|----------|------|
| 💰 收货价 | 建议收购入手价格 |
| 📈 转售价 | 正常渠道转卖的预期价格 |
| ⚡ 快速出货价 | 需要快速变现时的建议价格 |

---

## 🖥️ 界面预览

**上传阶段** → **AI 多轮问答** → **估价结果**

- 上传商品图片，AI 自动识别品牌、类别、名称
- 最多 5 轮智能提问（成色、使用时长、包装情况等）
- 输出结构化估价结果，支持一键复制

---

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite 8 |
| 样式 | Tailwind CSS v4 |
| AI 服务 | Kimi API（Moonshot）|
| 部署平台 | Vercel Serverless |

---

## 🚀 本地运行

### 1. 克隆项目

```bash
git clone https://github.com/vervegrow-cmyk/Inventory-Liquidity-AI.git
cd Inventory-Liquidity-AI
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

在项目根目录创建 `.env` 文件：

```
KIMI_API_KEY=你的_Kimi_API_Key
```

> Kimi API Key 获取地址：[platform.moonshot.cn](https://platform.moonshot.cn) → API Keys

### 4. 启动开发服务器

```bash
npm run dev
```

打开浏览器访问 [http://localhost:5173](http://localhost:5173)

> `npm run dev` 会同时启动前端（Vite，端口 5173）和本地 API 服务（端口 3001）。

---

## ☁️ 部署到 Vercel

1. 将项目推送到 GitHub
2. 在 [vercel.com](https://vercel.com) 导入该仓库
3. 在 Vercel 项目设置 → Environment Variables 中添加：
   ```
   KIMI_API_KEY = 你的_Kimi_API_Key
   ```
4. 点击部署，完成

---

## 📁 项目结构

```
├── api/
│   ├── identify.js      # 图片识别接口（Kimi Vision）
│   ├── chat.js          # 多轮对话估价接口
│   └── generate.js      # 通用生成接口
├── src/
│   ├── App.tsx          # 主界面（三阶段 UI）
│   └── index.css        # 全局样式
├── dev-server.js        # 本地开发 API 代理服务器
├── vercel.json          # Vercel 部署配置
└── .env                 # 环境变量（不提交到 Git）
```

---

## 🔒 安全说明

- `.env` 文件已加入 `.gitignore`，API Key 不会提交到代码仓库
- 所有 AI 接口调用在服务端（Serverless Function）执行，Key 不暴露到前端

---

## 📄 开源协议

MIT License
