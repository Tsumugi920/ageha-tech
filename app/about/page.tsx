import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { AboutSection } from "@/components/home/AboutSection";
import { JourneySection } from "@/components/home/JourneySection";

export const metadata: Metadata = {
  title: "关于我",
  description:
    "关于 Momori：助手在做小而可用的网页工具和实验项目 —— 自我介绍、兴趣方向、个人理念与探索路径。",
};

/**
 * 关于页：统一页头 + 复用首页「关于我」「探索与成长」两个版块
 * （设计语言与首页完全一致；照片为概念插画，版块内已如实标注）。
 */
export default function AboutPage() {
  return (
    <>
      <div className="site-container pt-14">
        <PageHeader
          eyebrow="About"
          title="关于我"
          description="我做小而可用的网页工具和实验项目；这一页汇总自我介绍、兴趣方向与探索路径。"
          back={{ href: "/", label: "返回首页" }}
        />
      </div>

      {/* 复用首页版块：桌面端 journey 嵌入 About 大板，移动端独立成块 */}
      <AboutSection />
      <JourneySection />
    </>
  );
}
