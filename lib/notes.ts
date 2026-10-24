/**
 * 文章与实验数据：供 LatestNotes 渲染。
 *
 * 【诚实说明】当前没有已发布文章 —— 以下三条是「写作计划」占位条目
 * （主题取自参考图确认的三个方向）。条目不含日期、阅读量与链接，
 * 且每条都会在页面上明确标注「写作计划中」；
 * 文章真正发布前，绝不在首页把它们伪装成已发布内容。
 */

/** 栏目（对应参考图三枚青色括号胶囊徽标） */
export type NoteCategory = "技术笔记" | "产品思考" | "设计探索";

/** 卡片配图的概念视觉主题（与整页插画同源的冷蓝紫意象） */
export type NoteMotif = "lake" | "city" | "aurora";

export type PlannedNote = {
  /** 栏目徽标文字 */
  category: NoteCategory;
  /** 计划中的文章标题 */
  title: string;
  /** 计划要写的内容摘要 */
  summary: string;
  /** 概念视觉占位缩略图的主题 */
  motif: NoteMotif;
};

/** 写作计划条目的统一状态标注（无日期、无阅读量、无链接） */
export const plannedNoteLabel = "写作计划中" as const;

export const plannedNotes: PlannedNote[] = [
  {
    category: "技术笔记",
    title: "从零搭建一个现代化的个人网站",
    summary: "记录使用 Next.js + Tailwind CSS 构建个人作品集的完整路径与思考。",
    motif: "lake",
  },
  {
    category: "产品思考",
    title: "如何选择适合自己的技术栈",
    summary: "从实际项目经验出发，聊聊技术选型的思考方式。",
    motif: "city",
  },
  {
    category: "设计探索",
    title: "交互设计中的微动效实践",
    summary: "分享一些提升用户体验的微交互设计与实现技巧。",
    motif: "aurora",
  },
];
