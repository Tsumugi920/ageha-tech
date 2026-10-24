import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { ContactSection } from "@/components/home/ContactSection";

export const metadata: Metadata = {
  title: "联系我",
  description:
    "联系 Ageha：如果你对作品感兴趣，或有值得一起探索的想法，欢迎通过 GitHub 联系我 —— 其他渠道接入中，配置完成后即可使用。",
};

/**
 * 联系页：统一页头 + 复用首页「联系我」夜景版块。
 * 【诚实边界】GitHub 为站长真实账号（github.com/Ageha6912）；
 * 其余渠道仍是「待配置」占位（版块内已如实标注），绝不虚构任何邮箱或社交链接。
 */
export default function ContactPage() {
  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-4 pt-14 md:px-8">
        <PageHeader
          eyebrow="Contact"
          title="联系我"
          description="GitHub 已接入，可以直接找到我；其余渠道接入中，配置完成前均显示「待配置」。如果你有值得一起探索的想法，欢迎常来这一页看看。"
          back={{ href: "/", label: "返回首页" }}
        />
      </div>

      {/* 复用首页夜景联系版块：GitHub 真实链接 + 其余渠道「待配置」非链接 + 蝴蝶点缀 */}
      <ContactSection />
    </>
  );
}
