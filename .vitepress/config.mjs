import { defineConfig } from 'vitepress'
import { readableTables } from './readable-tables.mjs'
import dailyQuizSidebar from '../daily-quizzes/sidebar.json'

// 行测只列方法；个人复盘统一从错题本进入
const sidebar = {
  '/daily-quizzes/': dailyQuizSidebar,
  '/shenlun/': [
    {
      text: '📘 申论 · 归纳概括',
      items: [
        { text: '从原文到答案 · 图解入口', link: '/shenlun/' },
        { text: 'DAY5 · 城市绿化（做法）', link: '/shenlun/day5-city-greening' },
        { text: 'DAY6 · 营商环境（措施与成效）', link: '/shenlun/day6-business-environment' },
        { text: 'DAY7 · 背包银行（特点与作用）', link: '/shenlun/day7-backpack-bank' },
        { text: 'DAY8 · 公共服务（问题不足）', link: '/shenlun/day8-public-services' },
        { text: 'DAY9 · 加数前行（原因）', link: '/shenlun/day9-digital-city' },
        { text: '特点与作用 · 区分及找点顺序', link: '/shenlun/features-vs-effects' },
        { text: '我的评分与进步记录', link: '/shenlun/scores' },
      ]
    },
    {
      text: '原题与完整来源',
      collapsed: true,
      items: [
        { text: 'DAY5 · 原题与讲义解析', link: '/shenlun/sources/day5-city-greening' },
        { text: 'DAY6 · 原题与讲义解析', link: '/shenlun/sources/day6-business-environment' },
        { text: 'DAY7 · 原题与讲义解析', link: '/shenlun/sources/day7-backpack-bank' },
        { text: 'DAY8 · 原题与讲义解析', link: '/shenlun/sources/day8-public-services' },
        { text: 'DAY9 · 原题与讲义解析', link: '/shenlun/sources/day9-digital-city' },
      ]
    }
  ],
  '/xingce/': [
    { text: '🗺️ 图解速查', link: '/xingce/图解速查' },
    {
      text: '🗣️ 言语理解',
      items: [
        { text: '📖 大宝小宝·体系正文(16章)', link: '/xingce/大宝小宝言语体系-正文' },
        { text: '言语理解方法库', link: '/xingce/yanyu-lijie' },
        { text: '词义辨析·107词', link: '/xingce/言语词义辨析积累表' },
        { text: '语句排序·完整流程', link: '/xingce/语句排序-先找衔接再验证整体' },
        { text: '语病辨析·检查框架', link: '/xingce/语病辨析-先找主干再检查关系' },
        { text: '🔍 文段识别速查卡', link: '/xingce/言语结构识别速查卡' },
      ]
    },
    {
      text: '🔢 数量关系',
      items: [
        { text: '数量关系方法库', link: '/xingce/shuliang-guanxi' },
        { text: '考场选法与适用边界', link: '/xingce/数量考场选法速查-2026-10-27' },
        { text: '📐 椭圆内接图形最值', link: '/xingce/椭圆考点与内接图形最值' },
      ]
    },
    {
      text: '🧩 判断推理',
      items: [
        { text: '逻辑与定义·四个检查句', link: '/xingce/逻辑与定义判断-四个检查句' },
        { text: '判断推理总览', link: '/xingce/panduan-tuili' },
        { text: '🔺 图形推理', link: '/xingce/panduan-tuxing' },
        { text: '图推特征与操作速查', link: '/xingce/图推特征与操作速查' },
        { text: '📋 定义判断', link: '/xingce/panduan-dingyi' },
        { text: '🔗 类比推理', link: '/xingce/panduan-leibi' },
        { text: '类比关系与验证句', link: '/xingce/类比具体关系积累表' },
        { text: '🎯 逻辑判断', link: '/xingce/panduan-luoji' },
      ]
    },
    {
      text: '📊 资料分析',
      items: [
        { text: '资料分析方法库', link: '/xingce/ziliao-fenxi' },
        { text: '读数与百化分1—20', link: '/xingce/资料分析读数与百化分速查' },
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
    { text: '行测错题本', items: [
      { text: '全部题目 · 按类型筛选', link: '/cuotiben/' },
      { text: '早期言语归位对照', link: '/cuotiben/言语体系总览与真题归位' },
      { text: '复盘方法', link: '/cuotiben/学习闭环' },
    ] },
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
      { text: '🗺️ 图解速查', link: '/xingce/图解速查' },
      { text: '🏠 首页', link: '/' },
      { text: '📝 每日测验', link: '/daily-quizzes/' },
      { text: '📘 申论', link: '/shenlun/' },
      { text: '🧠 错题本', link: '/cuotiben/' },
      { text: '📗 行测', items: [
        { text: '🗣️ 言语理解', link: '/xingce/yanyu-lijie' },
        { text: '🔢 数量关系', link: '/xingce/shuliang-guanxi' },
        { text: '🧩 判断推理', link: '/xingce/panduan-tuili' },
        { text: '📊 资料分析', link: '/xingce/ziliao-fenxi' },
        { text: '🌍 常识判断', link: '/xingce/changshi-panduan' },
      ] },
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
    config: readableTables,
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
