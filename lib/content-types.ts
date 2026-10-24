import type { LucideIcon } from "lucide-react";

/**
 * 首页各版块共享的内容类型定义。
 * 数据一律集中在 lib/ 下管理，组件只负责渲染。
 */

/**
 * 精选项目条目。
 *
 * 【诚实边界】本项目集仅收录「正在构建 / 持续打磨 / 技术探索」中的作品：
 * 刻意不设上线状态、演示链接、源码链接、日期等字段，避免任何夸大表述；
 * cover 为参考图裁切的概念视觉占位（非真实运行界面），coverAlt 如实标注。
 */
export type Project = {
  /** 路由 slug，详情页为 /projects/<slug> */
  slug: string;
  /** 项目名称 */
  name: string;
  /** 类别副题（英文 · 分隔小字） */
  category: string;
  /** 一句话介绍（过程性表述：探索 / 尝试 / 打磨） */
  description: string;
  /** 技术标签 */
  tags: string[];
  /** 封面图路径（概念视觉占位） */
  cover: string;
  /** 封面替代文本（如实描述为概念占位图） */
  coverAlt: string;
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
