import { WorldShell } from "@/components/world/WorldShell";

/**
 * 首页 = 3D 世界入口（Ageha 群岛）。
 *
 * - 页面组件保持服务端渲染：SEO / 元信息沿用 app/layout.tsx 的站点级
 *   metadata（标题「Ageha.tech — 用技术构建更有趣的数字世界」+ 描述），
 *   首页 <h1> 由 WorldShell 的常驻品牌标头提供（SSR 可见）；
 * - 3D Canvas 经 WorldShell 内 next/dynamic(ssr:false) 装载（Next 16 SSR 安全）；
 * - 全部项目 / 关于 / 技术栈 / 文章 / 联系内容仍由既有路由承接（零删改）。
 */
export default function Home() {
  return <WorldShell />;
}
