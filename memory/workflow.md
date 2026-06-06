---
name: workflow
description: 用户的日常工作流和常用命令
metadata:
  type: project
---

# 日常工作流

## 每日速记流程

1. 在 VS Code 中打开 `每日速记.md`
2. 在分隔线 `---` 下方，新内容写最上面
3. 格式：`#标签 #标签 内容`
4. 保存后终端执行：
   ```
   git add -A
   git commit -m "今日速记：内容摘要"
   git push
   ```

## 笔记写作流程

1. 在对应模块目录下创建/编辑 `.md` 文件
2. 本地预览：`npm run docs:dev` → `http://localhost:5173`
3. 满意后：`git add -A` → `git commit -m "内容"` → `git push`
4. GitHub Actions 自动部署到 GitHub Pages

## 项目管理

- 所有项目统一放在 `C:\Users\Administrator\Projects\`
- VS Code 用多根工作区管理多个项目
- 每个项目是独立的 Git 仓库

## VS Code 快捷键

| 操作 | 快捷键 |
|------|--------|
| 搜索文件 | `Ctrl+P` |
| 全局搜索 | `Ctrl+Shift+F` |
| 打开终端 | `Ctrl+`` |
| Git 面板 | `Ctrl+Shift+G` |

**Why:** 用户没有编程背景，需要清晰的步骤指引。
**How to apply:** 每次给操作建议时尽量给出具体命令，不要只说"提交代码"而要说 `git add -A; git commit -m "..."; git push`。

[[user-profile]] [[project-overview]]
