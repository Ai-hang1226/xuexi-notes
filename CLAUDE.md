# CLAUDE.md — 公务员备考知识库

## 项目定位

这是一个基于 VitePress 构建的个人知识库网站，用于公务员考试（行测/申论/面试）的备考笔记管理。同时作为知识博主的对外分享平台。

## 用户背景

- 身份：备考公务员考试的知识类博主
- 编程基础：无
- 目标：系统化学习笔记 → 形成知识体系 → 精选内容分享到公众号/小红书
- 偏好：中文交流、表格对比、简洁直接、不要一次改太多文件

## 技术栈

- **框架**：VitePress 1.6.4（Markdown 驱动，零前端基础可维护）
- **部署**：GitHub Pages（免费），仓库 `Ai-hang1226/xuexi-notes`
- **域名**：`https://Ai-hang1226.github.io/xuexi-notes/`
- **base 路径**：`/xuexi-notes/`
- **Node.js**：v22.22.2
- **编辑器**：VS Code + Claude Code 扩展（底层 DeepSeek V4 Pro）
- **数学公式**：markdown-it-mathjax3

## 项目结构

```
gongkao-notes/
├── index.md                      # 首页学习仪表盘
├── 每日速记.md                   # 每日速记（按日期往上堆）
├── .vitepress/config.mjs         # 导航、侧边栏、搜索配置
├── xingce/                       # 📗 行测（5个模块）
├── shenlun/                      # 📘 申论（5个题型）
├── mianshi/                      # 📙 面试（2个模块）
├── cuotiben/                     # 🧠 错题本
├── xuexi-rizhi/                  # 📝 学习日志
├── fenxiang/                     # 📢 分享区
└── memory/                       # 项目记忆（跨会话保留）
```

## 常用命令

```powershell
npm run docs:dev        # 本地启动 http://localhost:5173
npm run docs:build      # 构建生产版本到 .vitepress/dist/
git add -A; git commit -m "内容"; git push   # 每日速记推送
```

## 当前进度

- ✅ 网站已上线 GitHub Pages
- ✅ 行测/申论/面试/错题本/学习日志/分享区 骨架完成
- ✅ 每日速记功能 + 导航栏快捷入口
- ✅ 资料分析百化分笔记
- ✅ 一键推送脚本
- 🔜 内容持续填充中

## 我的工作方式

- 用 VS Code 写 Markdown 笔记
- `每日速记.md` 是快速记录入口，新内容写最上面
- 用 `git add/commit/push` 三条命令推送更新
- 网站自动部署，推送即更新
