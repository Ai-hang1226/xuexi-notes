import { defineConfig } from 'vitepress'

// 侧边栏配置 - 公务员考试知识结构
const sidebar = {
  '/xingce/': [
    {
      text: '📗 行测',
      items: [
        { text: '行测总览', link: '/xingce/' },
        { text: '言语理解与表达', link: '/xingce/yanyu-lijie' },
        { text: '数量关系', link: '/xingce/shuliang-guanxi' },
        { text: '判断推理', link: '/xingce/panduan-tuili' },
        { text: '资料分析', link: '/xingce/ziliao-fenxi' },
        { text: '常识判断', link: '/xingce/changshi-panduan' },
      ]
    }
  ],
  '/shenlun/': [
    {
      text: '📘 申论',
      items: [
        { text: '申论总览', link: '/shenlun/' },
        { text: '概括归纳', link: '/shenlun/gaikuo-guina' },
        { text: '综合分析', link: '/shenlun/zonghe-fenxi' },
        { text: '对策建议', link: '/shenlun/duice-jianyi' },
        { text: '公文写作', link: '/shenlun/gongwen-xiezuo' },
        { text: '大作文', link: '/shenlun/dazuowen' },
      ]
    }
  ],
  '/mianshi/': [
    {
      text: '📙 面试',
      items: [
        { text: '面试总览', link: '/mianshi/' },
        { text: '结构化面试', link: '/mianshi/jiegouhua-mianshi' },
        { text: '无领导小组', link: '/mianshi/wulingdao-xiaozu' },
      ]
    }
  ],
  '/cuotiben/': [
    {
      text: '🧠 错题本',
      items: [
        { text: '错题统计', link: '/cuotiben/' },
        { text: '行测错题集', link: '/cuotiben/xingce-cuoti' },
      ]
    }
  ],
  '/xuexi-rizhi/': [
    {
      text: '📝 学习日志',
      items: [
        { text: '日志列表', link: '/xuexi-rizhi/' },
        { text: '日志模板', link: '/xuexi-rizhi/template' },
      ]
    }
  ],
  '/fenxiang/': [
    {
      text: '📢 分享区',
      items: [
        { text: '精选文章', link: '/fenxiang/' },
        { text: '文章模板', link: '/fenxiang/template' },
      ]
    },
    {
      text: '🧠 言语理解专题',
      items: [
        { text: '言语·体系总览与真题归位', link: '/fenxiang/言语体系总览与真题归位' },
        { text: '言语·每日一页（打印版）', link: '/fenxiang/言语每日一页' },
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

  // 导航栏
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '📝 每日速记', link: '/每日速记' },
      { text: '行测', link: '/xingce/' },
      { text: '申论', link: '/shenlun/' },
      { text: '面试', link: '/mianshi/' },
      { text: '错题本', link: '/cuotiben/' },
      { text: '学习日志', link: '/xuexi-rizhi/' },
      { text: '分享区', link: '/fenxiang/' },
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
