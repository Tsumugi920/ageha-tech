import type { LucideIcon } from "lucide-react";

/**
 * 首页各版块共享的内容类型定义。
 * 数据一律集中在 lib/ 下管理，组件只负责渲染。
 */

/**
 * 项目真实入口链接。
 *
 * 【诚实边界】只收录有据可查的链接（站长仓库 README 中的线上地址 / 源码仓库），
 * 且域名受 tests 的白名单约束（ageha.cn 系与 github.com/Ageha6912）；
 * 没有依据的项目（如未上线的 Moss World）一律不设 links。
 */
export type ProjectLink = {
  /** 按钮文案：在线体验 / 查看源码 */
  label: string;
  /** 真实链接 */
  href: string;
  /** 外部链接：新窗口打开 */
  external: true;
};

/**
 * 精选项目条目。
 *
 * 【诚实边界】status / links / coverKind 只写有据可查的内容：
 * - status 仅有「已上线」（站长 README 载明线上地址）与「可本地运行」（仓库可运行、无上线记录）两种；
 * - links 仅指向真实可访问的入口，没有依据就整项省略；
 * - coverKind 区分「真实界面截图」与「概念视觉占位」，组件据实渲染徽标。
 */
export type Project = {
  /** 路由 slug，详情页为 /projects/<slug> */
  slug: string;
  /** 项目名称 */
  name: string;
  /** 类别副题（英文 · 分隔小字） */
  category: string;
  /** 一句话介绍（与项目仓库 README 口径一致，不夸大） */
  description: string;
  /** 技术标签（来自项目实际依赖） */
  tags: string[];
  /** 封面图路径 */
  cover: string;
  /** 封面替代文本（如实描述图片内容与性质） */
  coverAlt: string;
  /** 封面裁切焦点（object-position，默认居中；用于把真实截图对准最有信息量的区域） */
  coverPosition?: string;
  /** 封面性质：real = 项目真实界面截图；concept = 概念视觉占位 */
  coverKind: "real" | "concept";
  /** 如实状态：已上线 / 可本地运行 */
  status: "已上线" | "可本地运行";
  /** 真实入口按钮；无依据（未上线 / 无公开仓库）则整项省略 */
  links?: readonly ProjectLink[];
};

/** 「关于我」条目：圆形图标 + 标题 + 一行说明 */
export type AboutFact = {
  title: string;
  description: string;
  icon: LucideIcon;
};

/** 「探索与成长」时间线阶段（刻意不含年份等时间信息） */
export type JourneyStage = {
  title: string;
  description: string;
};
