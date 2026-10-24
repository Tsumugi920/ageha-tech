export type ButterflyLogoProps = {
  className?: string;
  /** 渐变 id：Logo 会在 Navbar 与 Footer 同时渲染，需各自唯一 */
  gradientId: string;
  title?: string;
};

/**
 * 蝴蝶 Logo 占位：四片蓝→青→紫渐变翅膀 + 身体触角的极简蝴蝶图形。
 * 正式 Logo 确定后替换为品牌 SVG / 图片资源。
 */
export function ButterflyLogo({
  className,
  gradientId,
  title = "Ageha.tech 蝴蝶 Logo 占位",
}: ButterflyLogoProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label={title}
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="4"
          y1="4"
          x2="28"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#269DFF" />
          <stop offset="0.55" stopColor="#54E3FF" />
          <stop offset="1" stopColor="#9C83FF" />
        </linearGradient>
      </defs>
      <g fill={`url(#${gradientId})`}>
        <ellipse cx="9.5" cy="12.5" rx="7" ry="5.5" transform="rotate(-24 9.5 12.5)" />
        <ellipse cx="22.5" cy="12.5" rx="7" ry="5.5" transform="rotate(24 22.5 12.5)" />
        <ellipse
          cx="11"
          cy="21.5"
          rx="5"
          ry="4"
          transform="rotate(18 11 21.5)"
          fillOpacity="0.7"
        />
        <ellipse
          cx="21"
          cy="21.5"
          rx="5"
          ry="4"
          transform="rotate(-18 21 21.5)"
          fillOpacity="0.7"
        />
      </g>
      <path
        d="M16 10.5v13"
        stroke="#10294B"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M16 10.5c-1.1-1.7-2.6-2.8-4.3-3.1M16 10.5c1.1-1.7 2.6-2.8 4.3-3.1"
        stroke="#10294B"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
