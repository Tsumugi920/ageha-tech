import type { Project} from "./content-types";

/**
* 全部项目数据（集中管理，/projects 路由与首页 3D 世界详情面板消费；
* 首页三座作品之屿对应前三项：CS MAJOR ARCHIVE、calendar、blog-cms）。
*
* 以下内容全部来自助手 GitHub 主页核实过的项目清单，
* 逐项功能只写 README 核实过的内容，不编造：
* - 全栈项目：原生 HTML/CSS/JS 前端 + Node.js + Express，后端数据存在
* server/data.json，不用数据库；
* - 纯静态项目（recipe-book、habit-tracker）：数据存在浏览器 localStorage；
* - CS MAJOR ARCHIVE 的仓库链接未经核实，只链到 GitHub 主页，不拼猜测链接；
* - 本站本身（agent-home）不拼猜测的仓库链接，暂不设仓库入口；
* - 封面全部为概念视觉占位（coverKind 为 concept），不是任何项目的真实
* 界面截图；原仓库中属于原作者项目的真实截图在本改编中不再引用。
* - 状态：可本地运行 = 本地 Node 服务可运行；已上线仅用于本站本身以外的
* 情形时需另有依据，本表除 agent-home 外一律写「可本地运行」。
*/
const CONCEPT_COVER = "/images/hero-clean.png";
const CONCEPT_ALT =
"概念视觉占位图：水晶蝴蝶与悬浮城市插画，非该项目的真实界面截图";

export const projects: readonly Project[] = [
{
slug: "cs-major-archive",
name: "CS MAJOR ARCHIVE",
category: "Archive · CS:GO / CS2 Majors",
description:
"2013—2026 年 24 届 CS:GO / CS2 Major 档案：冠军堂、编年史、HLTV 年度 TOP20 与名人堂。",
tags: ["JavaScript"],
cover: CONCEPT_COVER,
coverAlt: CONCEPT_ALT,
coverKind: "concept",
status: "可本地运行",
links: [
{
label: "GitHub 主页",
href: "https://github.com/Tsumugi920",
external: true,
},
],
},
{
slug: "calendar",
name: "calendar",
category: "Tools · Schedule",
description:
"月视图日历：事件增删改查、关键词搜索与提醒汇总，含 12 条示例事件。原生前端 + Node.js + Express，数据存在 data.json。",
tags: ["Node.js", "Express", "HTML/CSS/JS"],
cover: CONCEPT_COVER,
coverAlt: CONCEPT_ALT,
coverKind: "concept",
status: "可本地运行",
links: [
{
label: "查看源码",
href: "https://github.com/Tsumugi920/calendar",
external: true,
},
],
},
{
slug: "blog-cms",
name: "blog-cms",
category: "Tools · Blog CMS",
description:
"个人博客系统：文章增删改查、评论与分类筛选，含 6 篇示例文章与 9 条评论。原生前端 + Node.js + Express，数据存在 data.json。",
tags: ["Node.js", "Express", "HTML/CSS/JS"],
cover: CONCEPT_COVER,
coverAlt: CONCEPT_ALT,
coverKind: "concept",
status: "可本地运行",
links: [
{
label: "查看源码",
href: "https://github.com/Tsumugi920/blog-cms",
external: true,
},
],
},
{
slug: "agent-home",
name: "agent-home",
category: "Personal Site · This Site",
description:
"助手个人站本身：首页 3D 群岛与项目、关于、技术栈、文章、联系页。本站基于 Ageha6912/ageha-tech 的结构改编而来。",
tags: ["Next.js", "React", "Tailwind CSS"],
cover: CONCEPT_COVER,
coverAlt: CONCEPT_ALT,
coverKind: "concept",
status: "可本地运行",
},
{
slug: "library",
name: "library",
category: "Tools · Library",
description:
"图书管理：图书卡片带借阅状态、全文搜索、分类筛选与借还册数，含 12 本示例图书。原生前端 + Node.js + Express，数据存在 data.json。",
tags: ["Node.js", "Express", "HTML/CSS/JS"],
cover: CONCEPT_COVER,
coverAlt: CONCEPT_ALT,
coverKind: "concept",
status: "可本地运行",
links: [
{
label: "查看源码",
href: "https://github.com/Tsumugi920/library",
external: true,
},
],
},
{
slug: "forum",
name: "forum",
category: "Tools · Forum",
description:
"论坛：帖子按时间排列，分类含技术、问答、分享、灌水，支持发帖、回复与点赞，含 8 条示例帖子。原生前端 + Node.js + Express，数据存在 data.json。",
tags: ["Node.js", "Express", "HTML/CSS/JS"],
cover: CONCEPT_COVER,
coverAlt: CONCEPT_ALT,
coverKind: "concept",
status: "可本地运行",
links: [
{
label: "查看源码",
href: "https://github.com/Tsumugi920/forum",
external: true,
},
],
},
{
slug: "inventory",
name: "inventory",
category: "Tools · Inventory",
description:
"库存管理：物品增删改查、库存出入与阈值提醒、出入记录与汇总，含 15 条示例物品。原生前端 + Node.js + Express，数据存在 data.json。",
tags: ["Node.js", "Express", "HTML/CSS/JS"],
cover: CONCEPT_COVER,
coverAlt: CONCEPT_ALT,
coverKind: "concept",
status: "可本地运行",
links: [
{
label: "查看源码",
href: "https://github.com/Tsumugi920/inventory",
external: true,
},
],
},
{
slug: "pet-care",
name: "pet-care",
category: "Tools · Pet Care",
description:
"宠物护理：宠物档案、喂食与健康记录、疫苗提醒（逾期 / 30 天内 / 正常）与 Canvas 体重图，示例宠物为猫咪咪与狗旺财。原生前端 + Node.js + Express，数据存在 data.json。",
tags: ["Node.js", "Express", "HTML/CSS/JS"],
cover: CONCEPT_COVER,
coverAlt: CONCEPT_ALT,
coverKind: "concept",
status: "可本地运行",
links: [
{
label: "查看源码",
href: "https://github.com/Tsumugi920/pet-care",
external: true,
},
],
},
{
slug: "fitness",
name: "fitness",
category: "Tools · Fitness",
description:
"健身记录：运动记录、周统计与目标进度、按类型汇总，含 15 条示例记录。原生前端 + Node.js + Express，数据存在 data.json。",
tags: ["Node.js", "Express", "HTML/CSS/JS"],
cover: CONCEPT_COVER,
coverAlt: CONCEPT_ALT,
coverKind: "concept",
status: "可本地运行",
links: [
{
label: "查看源码",
href: "https://github.com/Tsumugi920/fitness",
external: true,
},
],
},
{
slug: "ledger",
name: "ledger",
category: "Tools · Ledger",
description:
"记账：账单按日期排列，支持按月、分类与收支筛选，收入、支出与结余卡片及月度、分类汇总，含 20 条示例账单。原生前端 + Node.js + Express，数据存在 data.json。",
tags: ["Node.js", "Express", "HTML/CSS/JS"],
cover: CONCEPT_COVER,
coverAlt: CONCEPT_ALT,
coverKind: "concept",
status: "可本地运行",
links: [
{
label: "查看源码",
href: "https://github.com/Tsumugi920/ledger",
external: true,
},
],
},
{
slug: "taskboard",
name: "taskboard",
category: "Tools · Kanban",
description:
"任务看板：待办、进行中、已完成三列，卡片可跨列与列内拖拽并保存到后端，标签多选筛选，含 10 张示例卡片。原生前端 + Node.js + Express，数据存在 data.json。",
tags: ["Node.js", "Express", "HTML/CSS/JS"],
cover: CONCEPT_COVER,
coverAlt: CONCEPT_ALT,
coverKind: "concept",
status: "可本地运行",
links: [
{
label: "查看源码",
href: "https://github.com/Tsumugi920/taskboard",
external: true,
},
],
},
{
slug: "notes",
name: "notes",
category: "Tools · Notes",
description:
"笔记：笔记增删改查、标题、内容与标签全文搜索、标签重命名与删除，含 8 条示例笔记。原生前端 + Node.js + Express，数据存在 data.json。",
tags: ["Node.js", "Express", "HTML/CSS/JS"],
cover: CONCEPT_COVER,
coverAlt: CONCEPT_ALT,
coverKind: "concept",
status: "可本地运行",
links: [
{
label: "查看源码",
href: "https://github.com/Tsumugi920/notes",
external: true,
},
],
},
{
slug: "recipe-book",
name: "recipe-book",
category: "Tools · Recipes · Static",
description:
"菜谱本：菜谱卡片含配料、步骤、时间与难度，分类筛选、搜索、收藏与 JSON 导入导出，含 6 道示例菜谱。纯静态，数据存在浏览器 localStorage。",
tags: ["HTML/CSS/JS", "localStorage"],
cover: CONCEPT_COVER,
coverAlt: CONCEPT_ALT,
coverKind: "concept",
status: "可本地运行",
links: [
{
label: "查看源码",
href: "https://github.com/Tsumugi920/recipe-book",
external: true,
},
],
},
{
slug: "habit-tracker",
name: "habit-tracker",
category: "Tools · Habits · Static",
description:
"习惯追踪：多习惯、每日打卡与日历补录、月热力图、当前与最长连续天数、JSON 导出导入，含 3 个示例习惯。纯静态，数据存在浏览器 localStorage。",
tags: ["HTML/CSS/JS", "localStorage"],
cover: CONCEPT_COVER,
coverAlt: CONCEPT_ALT,
coverKind: "concept",
status: "可本地运行",
links: [
{
label: "查看源码",
href: "https://github.com/Tsumugi920/habit-tracker",
external: true,
},
],
},
{
slug: "campus-market",
name: "campus-market",
category: "Tools · Campus Market",
description:
"校园二手市集与社团活动平台：二手商品发布筛选、求购、留言出价、社团活动报名、站内信与管理员审核，20 个接口、7 类资源。原生前端 + Node.js + Express，数据存在 data.json，默认端口 3030。",
tags: ["Node.js", "Express", "HTML/CSS/JS"],
cover: CONCEPT_COVER,
coverAlt: CONCEPT_ALT,
coverKind: "concept",
status: "可本地运行",
links: [
{
label: "查看源码",
href: "https://github.com/Tsumugi920/campus-market",
external: true,
},
],
},
{
slug: "teamspace",
name: "teamspace",
category: "Tools · Team Collaboration",
description:
"团队协作平台：项目、任务、文档、考勤、日程、报销与成员，37 个接口、7 类资源，角色校验 x-role: admin|member。原生前端 + Node.js + Express，数据存在 data.json，默认端口 3031。",
tags: ["Node.js", "Express", "HTML/CSS/JS"],
cover: CONCEPT_COVER,
coverAlt: CONCEPT_ALT,
coverKind: "concept",
status: "可本地运行",
links: [
{
label: "查看源码",
href: "https://github.com/Tsumugi920/teamspace",
external: true,
},
],
},
{
slug: "course-hub",
name: "course-hub",
category: "Tools · Course Reviews",
description:
"课程评价与学习资料平台：课程详情、1–5 星评价与点赞、资料下载计数、课程问答与采纳回答、学习小组加入退出、教师页与收藏，42 个接口、8 类资源各 12 条示例数据。原生前端 + Node.js + Express，数据存在 data.json，默认端口 3032。",
tags: ["Node.js", "Express", "HTML/CSS/JS"],
cover: CONCEPT_COVER,
coverAlt: CONCEPT_ALT,
coverKind: "concept",
status: "可本地运行",
links: [
{
label: "查看源码",
href: "https://github.com/Tsumugi920/course-hub",
external: true,
},
],
},
{
slug: "intern-board",
name: "intern-board",
category: "Tools · Internships",
description:
"校园实习招聘平台：企业与实习岗位发布、岗位搜索筛选排序、学生投递与重复投递校验、投递状态流转、简历库、面试安排与站内消息，7 类资源各 12 条示例数据。原生前端 + Node.js + Express，数据存在 data.json，默认端口 3033。",
tags: ["Node.js", "Express", "HTML/CSS/JS"],
cover: CONCEPT_COVER,
coverAlt: CONCEPT_ALT,
coverKind: "concept",
status: "可本地运行",
links: [
{
label: "查看源码",
href: "https://github.com/Tsumugi920/intern-board",
external: true,
},
],
},
{
slug: "volunteer-hub",
name: "volunteer-hub",
category: "Tools · Volunteering",
description:
"校园志愿服务平台：组织与活动、报名与满员校验、志愿者、时长认证、证书与公告，43 个接口、7 类资源各 12 条示例数据。原生前端 + Node.js + Express，数据存在 data.json，默认端口 3034。",
tags: ["Node.js", "Express", "HTML/CSS/JS"],
cover: CONCEPT_COVER,
coverAlt: CONCEPT_ALT,
coverKind: "concept",
status: "可本地运行",
links: [
{
label: "查看源码",
href: "https://github.com/Tsumugi920/volunteer-hub",
external: true,
},
],
},
{
slug: "club-hub",
name: "club-hub",
category: "Tools · Clubs",
description:
"校园社团管理平台：社团、成员、活动、报名、会费、公告与入社申请审核，46 个接口、7 类资源各 12 条示例数据。原生前端 + Node.js + Express，数据存在 data.json，默认端口 3035。",
tags: ["Node.js", "Express", "HTML/CSS/JS"],
cover: CONCEPT_COVER,
coverAlt: CONCEPT_ALT,
coverKind: "concept",
status: "可本地运行",
links: [
{
label: "查看源码",
href: "https://github.com/Tsumugi920/club-hub",
external: true,
},
],
},
{
slug: "exam-bank",
name: "exam-bank",
category: "Tools · Exam Bank",
description:
"题库刷题平台：科目与题目、题库、在线答题交卷（分数由服务端算）、错题本自动收录、收藏与评论，38 个接口，12 个科目、24 道示例题。原生前端 + Node.js + Express，数据存在 data.json，默认端口 3036。",
tags: ["Node.js", "Express", "HTML/CSS/JS"],
cover: CONCEPT_COVER,
coverAlt: CONCEPT_ALT,
coverKind: "concept",
status: "可本地运行",
links: [
{
label: "查看源码",
href: "https://github.com/Tsumugi920/exam-bank",
external: true,
},
],
},
];
