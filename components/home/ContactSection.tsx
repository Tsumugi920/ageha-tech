import { GlassCard } from "@/components/ui/GlassCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { site } from "@/lib/site";

/**
 * 联系方式（占位实现）：带 id="contact" 锚点的占位 section。
 * 所有联系方式均为「待配置」占位，真实账号接入前绝不虚构。
 */
export function ContactSection() {
  return (
    <section
      id="contact"
      aria-label="联系我"
      className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-20 md:px-8"
    >
      <SectionHeading
        eyebrow="Contact"
        title="联系我"
        description="占位内容：联系方式接入真实账号后逐项替换。"
      />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {site.contacts.map((contact) => (
          <GlassCard
            key={contact.label}
            className="flex flex-col items-center gap-2 p-6 text-center"
          >
            <span className="text-sm font-semibold text-text-primary">
              {contact.label}
            </span>
            <span className="font-mono text-xs text-text-muted">
              {contact.value}
            </span>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
