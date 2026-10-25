import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { ContactSection } from "@/components/home/ContactSection";

export const metadata: Metadata = {
  title: "联系我",
  description:
    "联系 Ageha：如果你对作品感兴趣，或有值得一起探索的想法，欢迎通过 GitHub 联系我 —— 其他渠道接入中，配置完成后即可使用。",
};

/**
 * 联系页：统一页头 + 复用首页「联系我」暮光版块。
 * 【诚实边界】GitHub 为站长真实账号（github.com/Ageha6912）；
 * 其余渠道未配置，按 configured 开关直接隐藏（不展示占位标注），
 * 绝不虚构任何邮箱或社交链接。
 */
export default function ContactPage() {
  return (
    <>
      <div className="site-container pt-14">
        <PageHeader
          eyebrow="Contact"
          title="联系我"
          description="GitHub 已接入，可以直接找到我；其他渠道会在配置完成后自动出现在联系区。如果你有值得一起探索的想法，欢迎常来这一页看看。"
          back={{ href: "/", label: "返回首页" }}
        />
      </div>

      {/* 复用首页暮光联系版块：GitHub 真实链接（新窗口打开）+ 蝴蝶点缀；
          未配置渠道按 configured 开关隐藏 */}
      <ContactSection />
    </>
  );
}
