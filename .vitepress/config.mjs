import { defineConfig } from 'vitepress'

// 侧边栏配置 - 行测五大模块（按模块分，不再有"行测"总览伞）
const sidebar = {
  '/xingce/': [
    {
      text: '🗣️ 言语理解',
      items: [
        { text: '言语理解方法库', link: '/xingce/yanyu-lijie' },
        { text: '🔍 文段识别速查卡', link: '/xingce/言语结构识别速查卡' },
        { text: '📌 言语·今日学习复盘', link: '/xingce/言语学习复盘-2026-09-13' },
        { text: '✅ 言语·真题归位(14题)', link: '/xingce/言语体系总览与真题归位' },
        { text: '🖨️ 言语·每日一页(打印)', link: '/xingce/言语每日一页' },
      ]
    },
    {
      text: '🔢 数量关系',
      items: [
        { text: '数量关系方法库', link: '/xingce/shuliang-guanxi' },
        { text: '📐 椭圆考点与内接图形最值', link: '/xingce/椭圆考点与内接图形最值' },
      ]
    },
    {
      text: '🧩 判断推理',
      items: [
        { text: '判断推理总览', link: '/xingce/panduan-tuili' },
        { text: '🔺 图形推理', link: '/xingce/panduan-tuxing' },
        { text: '📋 定义判断', link: '/xingce/panduan-dingyi' },
        { text: '🔗 类比推理', link: '/xingce/panduan-leibi' },
        { text: '🎯 逻辑判断', link: '/xingce/panduan-luoji' },
      ]
    },
    {
      text: '📊 资料分析',
      items: [
        { text: '资料分析方法库', link: '/xingce/ziliao-fenxi' },
      ]
    },
    {
      text: '🌍 常识判断',
      items: [
        { text: '常识判断积累', link: '/xingce/changshi-panduan' },
      ]
    },
  ],
  '/cuotiben/': [
    {
      text: '🧠 错题本',
      items: [
        { text: '错题统计', link: '/cuotiben/' },
        { text: '学习闭环（通用模板）', link: '/cuotiben/学习闭环' },
        { text: '行测错题集（按模块）', link: '/cuotiben/xingce-cuoti' },
      ]
    }
  ],
}

export default defineConfig({
  title: '考公知识库',
  description: '个人公务员备考知识库 - 学习 × 记录 × 成长 × 分享',
  lang: 'zh-CN',
  base: '/xuexi-notes/',
  cleanUrls: true,

  // 不进入站点：项目指令/记忆/演示文件，避免污染搜索结果
  srcExclude: [
    'AGENTS.md',
    'CLAUDE.md',
    'MEMORY.md',
    '扩展演示-AutoCorrect.md',
    'memory/**',
  ],

  // 导航栏
  themeConfig: {
    nav: [
      { text: '🏠 首页', link: '/' },
      { text: '🗣️ 言语理解', link: '/xingce/yanyu-lijie' },
      { text: '🔢 数量关系', link: '/xingce/shuliang-guanxi' },
      { text: '🧩 判断推理', link: '/xingce/panduan-tuili' },
      { text: '📊 资料分析', link: '/xingce/ziliao-fenxi' },
      { text: '🌍 常识判断', link: '/xingce/changshi-panduan' },
      { text: '🧠 错题本', link: '/cuotiben/' },
    ],

    sidebar,

    // 社交链接（可选，以后添加）
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Ai-hang1226/xuexi-notes' }
    ],

    // 页脚
    footer: {
      message: '学而不思则罔，思而不学则殆',
      copyright: 'Copyright © 2026 | 个人考公知识库'
    },

    // 搜索
    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: '搜索',
            buttonAriaLabel: '搜索笔记'
          },
          modal: {
            noResultsText: '没有找到相关内容',
            resetButtonTitle: '清除搜索',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭'
            }
          }
        }
      }
    },

    // 大纲（右侧目录）
    outline: {
      level: [2, 3],
      label: '本页目录'
    },

    // 文档页脚（上一页/下一页）
    docFooter: {
      prev: '← 上一篇',
      next: '下一篇 →'
    },
  },

  // Markdown 配置
  markdown: {
    math: true,           // 支持数学公式（资料分析、数量关系用）
    lineNumbers: true,    // 代码行号
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    }
  },

  // Vite 配置
  vite: {
    server: {
      host: true,
      port: 5173
    }
  }
})
