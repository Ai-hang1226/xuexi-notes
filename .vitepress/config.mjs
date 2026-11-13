import { defineConfig } from 'vitepress'
import { readableTables } from './readable-tables.mjs'
import dailyQuizSidebar from '../daily-quizzes/sidebar.json'

// ─────────────────────────────────────────────────────────────
// 全站分类原则（依据官方考试大纲 + 内容本身逻辑关系）
//   行测：六大模块（政治理论 / 言语 / 数量 / 判断 / 资料 / 常识），
//         政治理论自 2025 年起从常识判断单列；判断推理再分图形 / 定义 / 类比 / 逻辑四种题型。
//   申论：五大题型（归纳概括 / 综合分析 / 问题对策 / 公文写作 / 文章写作）。
//         Kiwi 讲义框架是覆盖五大题型的「总纲」，独立一级，
//         不隶属于任何单一题型；DAY5—DAY9 是总纲之下
//         「归纳概括」这一题型的实际练习。
//   测验：总览规则 → 专题测评 → 按月份归档。
//   错题本：检索 → 复盘方法 → 按模块专项 → 整卷与阶段 → 词库 → 归档。
//   工具：跨模块速查 / 计算 / 归档 / 站点指南。
// 所有原有笔记与链接均保留；重定向页不再占侧栏位置。
// ─────────────────────────────────────────────────────────────

// 把每日测验按天平铺的侧栏自动归入「总览 / 专题测评 / 月份」，以后新增日期会自动归类
const allQuizGroups = dailyQuizSidebar
const dateGroups = allQuizGroups.filter((g) => /^\d{4}-\d{2}-\d{2}$/.test(g.text))
const specialGroups = allQuizGroups.filter((g) => !/^\d{4}-\d{2}-\d{2}$/.test(g.text))
const [quizBase, ...quizAssessments] = specialGroups
const byMonth = {}
for (const g of dateGroups) {
  const month = g.text.slice(0, 7)
  ;(byMonth[month] ||= []).push({ text: g.text.slice(5), items: g.items })
}
const quizSidebar = [
  {
    text: '📌 总览与规则',
    items: [
      ...quizBase.items,
      { text: '🧪 交流体验卷（不计正式）', link: '/daily-quizzes/2026-10-24-trial' },
      { text: '📅 按月份归档', link: '/guide/archive' },
    ],
  },
  ...quizAssessments.map((g) => ({ ...g, collapsed: true })),
  ...Object.entries(byMonth).map(([month, groups]) => ({
    text: `📅 ${month.slice(0, 4)} 年 ${Number(month.slice(5))} 月`,
    collapsed: true,
    items: groups,
  })),
]

const kiwi = '/shenlun/kiwi-framework'
const sidebar = [
  // ===== 行测：六大模块（官方大纲）=====
  {
    text: '📗 行测',
    collapsed: true,
    items: [
      { text: '🗺️ 跨模块图解速查', link: '/xingce/图解速查' },
      {
        text: '🚩 政治理论（2025 起单列）',
        collapsed: false,
        items: [
          { text: '🧭 学习路径', link: '/guide/zhengzhi' },
          { text: '📖 章节导航 · 5 章', link: '/xingce/政治理论章节导航' },
          { text: '📚 知识页 · 考查范围与技巧', link: '/xingce/zhengzhi-lilun' },
        ],
      },
      {
        text: '🗣️ 言语理解与表达',
        collapsed: true,
        items: [
          { text: '🧭 学习路径', link: '/guide/yanyu' },
          { text: '📖 体系 · 16 章导航', link: '/xingce/言语体系章节导航' },
          { text: '📚 体系正文（完整 519KB）', link: '/xingce/大宝小宝言语体系-正文' },
          { text: '✅ 章节编号与答案勘误表', link: '/xingce/言语体系答案勘误表' },
          { text: '🧭 方法库', link: '/xingce/yanyu-lijie' },
          { text: '逻辑填空 · 先找依据再比词', link: '/xingce/逻辑填空先找语境依据再比词' },
          { text: '语句排序 · 先找衔接再验证整体', link: '/xingce/语句排序-先找衔接再验证整体' },
          { text: '语病辨析 · 先找主干再检查关系', link: '/xingce/语病辨析-先找主干再检查关系' },
          { text: '🔍 速查 · 文段结构识别卡', link: '/xingce/言语结构识别速查卡' },
          { text: '🔍 速查 · 词义辨析 115 词', link: '/xingce/言语词义辨析积累表' },
        ],
      },
      {
        text: '🔢 数量关系',
        collapsed: true,
        items: [
          { text: '🧭 学习路径', link: '/guide/shuliang' },
          { text: '📖 体系 · 16 章导航', link: '/xingce/数量关系章节导航' },
          { text: '📚 体系正文（完整）', link: '/xingce/shuliang-guanxi' },
          { text: '🧭 考场选法与适用边界', link: '/xingce/数量考场选法速查-2026-10-27' },
          { text: '专题 · 分段与比例检查', link: '/xingce/数量关系-分段与比例检查' },
          { text: '专题 · 浓度题两列记账', link: '/xingce/浓度题-先列溶液与溶质' },
          { text: '专题 · 椭圆内接图形最值', link: '/xingce/椭圆考点与内接图形最值' },
        ],
      },
      {
        text: '🧩 判断推理',
        collapsed: true,
        items: [
          { text: '🧭 学习路径', link: '/guide/panduan' },
          { text: '📖 体系 · 四大题型导航', link: '/xingce/判断推理章节导航' },
          { text: '📖 总览 · 四大题型', link: '/xingce/panduan-tuili' },
          {
            text: '🔺 图形推理',
            collapsed: true,
            items: [
              { text: '知识框架与操作方法', link: '/xingce/图推特征与操作速查' },
              { text: '图推逐点图解', link: '/xingce/panduan-tuxing' },
              { text: '空间折叠 · 公共边与顶点', link: '/xingce/空间折叠-公共边与顶点对应' },
              { text: '图例 · 定性分析', link: '/xingce/图推图例/01-定性' },
              { text: '图例 · 定量分析', link: '/xingce/图推图例/02-定量' },
              { text: '图例 · 位置分析', link: '/xingce/图推图例/03-位置' },
              { text: '图例 · 特殊图', link: '/xingce/图推图例/04-特殊图' },
              { text: '图例 · 文字与提示', link: '/xingce/图推图例/05-文字与提示' },
              { text: '图例 · 立体图', link: '/xingce/图推图例/06-立体' },
            ],
          },
          { text: '📋 定义判断', link: '/xingce/panduan-dingyi' },
          {
            text: '🔗 类比推理',
            collapsed: true,
            items: [
              { text: '方法库', link: '/xingce/panduan-leibi' },
              { text: '具体关系积累表', link: '/xingce/类比具体关系积累表' },
            ],
          },
          {
            text: '🎯 逻辑判断',
            collapsed: true,
            items: [
              { text: '方法库 · 对象与反例', link: '/xingce/panduan-luoji' },
              { text: '对象与反例检查（图解）', link: '/xingce/逻辑判断-对象与反例检查' },
              { text: '逻辑与定义 · 四个检查句', link: '/xingce/逻辑与定义判断-四个检查句' },
            ],
          },
        ],
      },
      {
        text: '📊 资料分析',
        collapsed: true,
        items: [
          { text: '🧭 学习路径', link: '/guide/ziliao' },
          { text: '📖 体系 · 方法体系导航', link: '/xingce/资料分析章节导航' },
          { text: '📖 方法库', link: '/xingce/ziliao-fenxi' },
          { text: '专题 · 平均数与比重', link: '/xingce/平均数与比重-先辨问法再选公式' },
          { text: '🔍 速查 · 读数与百化分 1—20', link: '/xingce/资料分析读数与百化分速查' },
        ],
      },
      {
        text: '🌍 常识判断',
        collapsed: true,
        items: [
          { text: '🧭 学习路径', link: '/guide/changshi' },
          { text: '📖 体系 · 知识范围导航', link: '/xingce/常识判断章节导航' },
          { text: '积累笔记', link: '/xingce/changshi-panduan' },
        ],
      },
    ],
  },

  // ===== 申论：总纲 + 五大题型（官方大纲）=====
  {
    text: '📘 申论',
    collapsed: true,
    items: [
      { text: '🏠 申论总览 · 从原文到答案', link: '/shenlun/' },
      { text: '🧭 学习路径', link: '/guide/shenlun' },
      // 总纲独立一级，与「按题型练」平级，不塞进归纳概括
      { text: '📖 总纲 · Kiwi 申论知识框架（五大题型）', link: kiwi },
      { text: '📖 总纲 · 五大题型导航', link: '/shenlun/五大题型导航' },
      {
        text: '🎯 按题型练（五大题型）',
        collapsed: false,
        items: [
          {
            text: '📒 归纳概括',
            collapsed: true,
            items: [
              { text: '📖 讲义精读 · 四步框架与 11 类要素', link: '/shenlun/guina-gaikuo' },
              { text: '📖 讲义方法 → Kiwi 总纲', link: `${kiwi}#归纳概括-问什么-归纳什么` },
              { text: '🔍 特点与作用 · 找点方法', link: '/shenlun/features-vs-effects' },
              { text: 'DAY5 · 城市绿化（概括做法）', link: '/shenlun/day5-city-greening' },
              { text: 'DAY6 · 营商环境（措施＋成效）', link: '/shenlun/day6-business-environment' },
              { text: 'DAY7 · 背包银行（特点与作用）', link: '/shenlun/day7-backpack-bank' },
              { text: 'DAY8 · 公共服务（问题与不足）', link: '/shenlun/day8-public-services' },
              { text: 'DAY9 · 加数前行（原因）', link: '/shenlun/day9-digital-city' },
            ],
          },
          {
            text: '🔍 综合分析',
            collapsed: true,
            items: [
              { text: '📖 讲义精读 · 五类题型答题框架', link: '/shenlun/zonghe-fenxi' },
              { text: '📖 讲义方法 → Kiwi 总纲', link: `${kiwi}#三、综合分析-观点和依据要对齐` },
            ],
          },
          {
            text: '💡 问题对策',
            collapsed: true,
            items: [
              { text: '📖 讲义精读 · 命题形态与对策来源', link: '/shenlun/wenti-duice' },
              { text: '📖 讲义方法 → Kiwi 总纲', link: `${kiwi}#四、问题对策-先有问题-再看办法` },
            ],
          },
          {
            text: '📄 公文写作',
            collapsed: true,
            items: [
              { text: '📖 讲义精读 · 13 种文种格式速查', link: '/shenlun/gongwen-geshi' },
              { text: '📖 讲义方法 → Kiwi 总纲', link: `${kiwi}#五、公文写作-文种和任务决定结构` },
            ],
          },
          {
            text: '✍️ 文章写作',
            collapsed: true,
            items: [
              { text: '📖 讲义精读 · 论点与骨架', link: '/shenlun/wenzhang-xiezuo' },
              { text: '📖 讲义方法 → Kiwi 总纲', link: `${kiwi}#六、文章写作-从立意到论证` },
            ],
          },
        ],
      },
      { text: '📊 评分与进步记录', link: '/shenlun/scores' },
      {
        text: '📂 原题与讲义',
        collapsed: true,
        items: [
          { text: 'DAY5 · 城市绿化', link: '/shenlun/sources/day5-city-greening' },
          { text: 'DAY6 · 营商环境', link: '/shenlun/sources/day6-business-environment' },
          { text: 'DAY7 · 背包银行', link: '/shenlun/sources/day7-backpack-bank' },
          { text: 'DAY8 · 创新公共服务', link: '/shenlun/sources/day8-public-services' },
          { text: 'DAY9 · 加数前行', link: '/shenlun/sources/day9-digital-city' },
        ],
      },
    ],
  },

  // ===== 每日测验：总览 → 专题测评 → 月份归档 =====
  { text: '📝 每日测验', collapsed: true, items: quizSidebar },

  // ===== 错题本：检索 → 方法 → 按模块 → 整卷 → 词库 → 归档 =====
  {
    text: '🧠 错题本',
    collapsed: true,
    items: [
      { text: '📊 全部题目 · 筛选检索', link: '/cuotiben/' },
      {
        text: '🧭 怎么复盘',
        collapsed: true,
        items: [
          { text: '学习闭环', link: '/cuotiben/学习闭环' },
          { text: '按问题回看 · 对象 / 分母 / 目标式', link: '/cuotiben/repeated-issues' },
          { text: '考前一个月复习执行图', link: '/cuotiben/考前一个月复习执行图' },
          { text: 'AI 辅助备考图解报告', link: '/cuotiben/AI辅助备考图解报告' },
        ],
      },
      {
        text: '🗣️ 言语理解 · 复盘',
        collapsed: true,
        items: [
          { text: '体系总览与真题归位', link: '/cuotiben/言语体系总览与真题归位' },
          { text: '言语每日一页（打印版）', link: '/cuotiben/言语每日一页' },
          { text: '学习复盘 · 2026-09-13', link: '/cuotiben/言语学习复盘-2026-09-13' },
          { text: '专项复盘 · 10-17（17 题）', link: '/cuotiben/言语理解专项复盘-2026-10-17' },
          { text: '专项复盘 · 10-30（3 错＋1 纠结）', link: '/cuotiben/言语理解专项复盘-2026-10-30' },
        ],
      },
      {
        text: '🔢 数量关系 · 复盘',
        collapsed: true,
        items: [
          { text: '专项复盘 · 10-14（10 题）', link: '/cuotiben/数量关系专项复盘-2026-10-14' },
          { text: '专项复盘 · 10-27（19 题）', link: '/cuotiben/数量关系专项复盘-2026-10-27' },
          { text: '专项复盘 · 11-04（分段与比例）', link: '/cuotiben/数量关系专项复盘-2026-11-04' },
        ],
      },
      {
        text: '🧩 判断推理 · 复盘',
        collapsed: true,
        items: [
          { text: '判断推理总复盘 · 10-07', link: '/cuotiben/判断推理专项复盘-2026-10-07' },
          {
            text: '🔺 图形推理',
            collapsed: true,
            items: [
              { text: '10-21（10 题完整）', link: '/cuotiben/图形推理专项复盘-2026-10-21' },
              { text: '11-02（两题分类）', link: '/cuotiben/图形推理专项复盘-2026-11-02' },
              { text: '11-03（全 10 题）', link: '/cuotiben/图形推理专项复盘-2026-11-03' },
            ],
          },
          { text: '📋 定义判断 · 11-02', link: '/cuotiben/定义判断专项复盘-2026-11-02' },
          {
            text: '🔗 类比推理',
            collapsed: true,
            items: [
              { text: '10-30（7 题）', link: '/cuotiben/类比推理专项复盘-2026-10-30' },
              { text: '11-03（四题关系辨析）', link: '/cuotiben/类比推理专项复盘-2026-11-03' },
            ],
          },
          {
            text: '🎯 逻辑判断',
            collapsed: true,
            items: [
              { text: '11-02（两题分类）', link: '/cuotiben/逻辑判断专项复盘-2026-11-02' },
              { text: '11-04（对象 / 因果 / 反例）', link: '/cuotiben/逻辑判断专项复盘-2026-11-04' },
            ],
          },
        ],
      },
      {
        text: '📊 资料分析 · 复盘',
        collapsed: true,
        items: [
          { text: '专项复盘 · 10-07（贡献率）', link: '/cuotiben/资料分析专项复盘-2026-10-07' },
          { text: '专项复盘 · 10-27（5 题）', link: '/cuotiben/资料分析专项复盘-2026-10-27' },
          { text: '专项复盘 · 11-02（三错＋四慢）', link: '/cuotiben/资料分析专项复盘-2026-11-02' },
        ],
      },
      {
        text: '📋 整卷与阶段测评 · 复盘',
        collapsed: true,
        items: [
          { text: '135 题混合真题 · 42 题批改', link: '/cuotiben/135题混合真题批改-2026-11-07' },
          { text: '江苏 A 类阶段测评 · 11-04', link: '/cuotiben/江苏A类阶段测评复盘-2026-11-04' },
          { text: '每日测验 · 11-06 八题复盘', link: '/cuotiben/每日测验复盘-2026-11-06' },
          { text: '早期行测补充复盘', link: '/cuotiben/早期行测补充复盘' },
        ],
      },
      {
        text: '📖 词库与积累',
        collapsed: true,
        items: [
          { text: '135 题逻辑填空 · 全选项词义', link: '/cuotiben/135题混合真题逻辑填空全选项词义-2026-11-09' },
        ],
      },
      {
        text: '🗄️ 历史归档',
        collapsed: true,
        items: [
          { text: '归档历史', link: '/cuotiben/归档历史' },
          { text: '行测错题集（早期汇总）', link: '/cuotiben/xingce-cuoti' },
        ],
      },
    ],
  },

  // ===== 精选导读：对外可传播的一层 =====
  {
    text: '✨ 精选导读',
    collapsed: false,
    items: [
      { text: '导读首页', link: '/share/' },
      { text: '资料分析 · 7 道错题的共同卡点', link: '/share/data-analysis-7-mistakes' },
      { text: '申论 · 归纳概括五种要素', link: '/share/shenlun-summary-5-elements' },
    ],
  },

  // ===== 工具与指南 =====
  {
    text: '🧰 工具与指南',
    collapsed: false,
    items: [
      { text: '🗺️ 图解速查', link: '/xingce/图解速查' },
      { text: '🧮 速算工具箱', link: '/tools/' },
      { text: '📌 使用指南', link: '/guide/help' },
      { text: '🕘 更新日志', link: '/guide/changelog' },
      { text: '🖨️ 江苏 A4 打印讲义', link: '/jiangsu/printable.html' },
    ],
  },
]

export default defineConfig({
  title: '考公知识库',
  description: '行测知识、申论训练、真题测验与错题复盘的清晰入口',
  lang: 'zh-CN',
  base: '/xuexi-notes/',
  cleanUrls: true,

  // 分享卡片必须用绝对 URL，相对路径多数平台抓取不到
  sitemap: { hostname: 'https://ai-hang1226.github.io/xuexi-notes' },

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/xuexi-notes/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#4f46e5' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: '考公知识库' }],
    ['meta', { property: 'og:url', content: 'https://ai-hang1226.github.io/xuexi-notes/' }],
    ['meta', { property: 'og:title', content: '考公知识库 · 学习目录' }],
    ['meta', { property: 'og:description', content: '行测知识、申论训练、真题测验与错题复盘的清晰入口' }],
    ['meta', { property: 'og:image', content: 'https://ai-hang1226.github.io/xuexi-notes/og-cover.png' }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: 'https://ai-hang1226.github.io/xuexi-notes/og-cover.png' }],
  ],

  srcExclude: ['AGENTS.md', 'CLAUDE.md', 'MEMORY.md', '扩展演示-AutoCorrect.md', 'memory/**', 'data/**', '.workbuddy/**', 'docs/**'],

  themeConfig: {
    logo: '/logo.svg',
    sidebarMenuLabel: '菜单',
    returnToTopLabel: '返回顶部',
    darkModeSwitchLabel: '外观',
    nav: [
      { text: '🏠 首页', link: '/' },
      {
        text: '📗 行测',
        items: [
          { text: '🚩 政治理论', link: '/xingce/zhengzhi-lilun' },
          { text: '🗣️ 言语理解', link: '/xingce/yanyu-lijie' },
          { text: '🔢 数量关系', link: '/xingce/shuliang-guanxi' },
          { text: '🧩 判断推理', link: '/xingce/panduan-tuili' },
          { text: '📊 资料分析', link: '/xingce/ziliao-fenxi' },
          { text: '🌍 常识判断', link: '/xingce/changshi-panduan' },
          { text: '🗺️ 图解速查', link: '/xingce/图解速查' },
        ],
      },
      {
        text: '📘 申论',
        items: [
          { text: '🏠 申论总览 · 从原文到答案', link: '/shenlun/' },
          { text: '📖 总纲 · Kiwi 五大题型', link: kiwi },
          { text: '📒 归纳概括 · 真题', link: '/shenlun/day5-city-greening' },
          { text: '📊 评分与进步', link: '/shenlun/scores' },
        ],
      },
      { text: '📝 每日测验', link: '/daily-quizzes/' },
      { text: '🧠 错题本', link: '/cuotiben/' },
      {
        text: '📚 更多',
        items: [
          { text: '✨ 精选导读', link: '/share/' },
          { text: '🗺️ 全站地图', link: '/guide/' },
          { text: '🧰 速算工具箱', link: '/tools/' },
          { text: '📌 使用指南', link: '/guide/help' },
          { text: '🕘 更新日志', link: '/guide/changelog' },
          { text: '🖨️ 江苏 A4 打印讲义', link: '/jiangsu/printable.html' },
        ],
      },
    ],

    sidebar,

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Ai-hang1226/xuexi-notes' }
    ],

    footer: {
      message: '学而不思则罔，思而不学则殆',
      copyright: 'Copyright © 2026 | 个人考公知识库'
    },

    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索', buttonAriaLabel: '搜索笔记' },
          modal: {
            noResultsText: '没有找到相关内容',
            resetButtonTitle: '清除搜索',
            footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' }
          }
        }
      }
    },

    // 目录纳入 h1 章标题，让「第一章」「一、倍数特性」这类章节直接进入右侧本页目录。
    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '← 上一篇', next: '下一篇 →' },
  },

  markdown: {
    config: readableTables,
    math: true,
    lineNumbers: true,
    theme: { light: 'github-light', dark: 'github-dark' }
  },

  vite: {
    server: { host: true, port: 5174 },
    // 正式构建（CI / 部署）清空 dist，避免旧 hash 产物累积；
    // 本地沙箱用 DEBUG=1 跳过清空（safe-delete 守卫会拦截批量删除）。
    build: { emptyOutDir: !process.env.DEBUG }
  }
})
