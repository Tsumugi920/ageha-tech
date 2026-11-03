export type ButterflyLogoProps = {
  className?: string;
  /** 渐变 id：Logo 会在 Navbar 与 Footer 同时渲染，需各自唯一 */
  gradientId: string;
  title?: string;
  /**
   * 纯装饰模式：与可见品牌文字 / 已命名链接并存时开启，
   * 撤下 role="img" + aria-label 并置 aria-hidden，避免读屏器
   * 重复播报「Momori 蝴蝶 Logo」。
   */
  decorative?: boolean;
};

/**
 * 蝴蝶 Logo：几何切面风格 —— 四片翅膀取自参考图主视觉的水晶蝴蝶意象，
 * 蓝紫渐变 + 半透明白色切面高光，深藏青身体与触角收束重心。
 * （components/home/Hero.tsx 场景与 app/icon.svg 同源同款）
 */
export function ButterflyLogo({
  className,
  gradientId,
  title = "Momori 蝴蝶 Logo",
  decorative = false,
}: ButterflyLogoProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : title}
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="10"
          y1="6"
          x2="38"
          y2="42"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#54E3FF" />
          <stop offset="0.5" stopColor="#269DFF" />
          <stop offset="1" stopColor="#9C83FF" />
        </linearGradient>
        <linearGradient
          id={`${gradientId}-lower`}
          x1="12"
          y1="38"
          x2="36"
          y2="16"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#9C83FF" />
          <stop offset="0.55" stopColor="#3B8BF5" />
          <stop offset="1" stopColor="#54E3FF" />
        </linearGradient>
      </defs>

      {/* 上翅 */}
      <path
        d="M22.6 19.6C19.4 12.6 12.6 7.2 8.2 8.4C4.6 9.4 4.4 14.4 7.6 18.4C10.6 22.2 17.4 24.2 22.6 23.2Z"
        fill={`url(#${gradientId})`}
        stroke="#EAF6FF"
        strokeOpacity="0.35"
        strokeWidth="0.6"
      />
      <path
        d="M25.4 19.6C28.6 12.6 35.4 7.2 39.8 8.4C43.4 9.4 43.6 14.4 40.4 18.4C37.4 22.2 30.6 24.2 25.4 23.2Z"
        fill={`url(#${gradientId})`}
        stroke="#EAF6FF"
        strokeOpacity="0.35"
        strokeWidth="0.6"
      />

      {/* 下翅 */}
      <path
        d="M22.8 25.4C18.6 25.8 13.6 27.8 12 31.2C10.6 34.4 13 37.6 16.4 36.8C19.8 36 22.4 32.2 23.4 28.2Z"
        fill={`url(#${gradientId}-lower)`}
        fillOpacity="0.88"
      />
      <path
        d="M25.2 25.4C29.4 25.8 34.4 27.8 36 31.2C37.4 34.4 35 37.6 31.6 36.8C28.2 36 25.6 32.2 24.6 28.2Z"
        fill={`url(#${gradientId}-lower)`}
        fillOpacity="0.88"
      />

      {/* 切面高光：三角形亮面 + 细分割线 */}
      <path
        d="M22.4 19.8L11 12L13.2 19.8Z"
        fill="#FFFFFF"
        fillOpacity="0.18"
      />
      <path
        d="M25.6 19.8L37 12L34.8 19.8Z"
        fill="#FFFFFF"
        fillOpacity="0.18"
      />
      <g stroke="#EAF6FF" strokeOpacity="0.5" strokeWidth="0.7" strokeLinecap="round">
        <path d="M21.8 20L9.8 12.2" />
        <path d="M21.4 21.6L10.4 18.6" />
        <path d="M26.2 20L38.2 12.2" />
        <path d="M26.6 21.6L37.6 18.6" />
        <path d="M22.6 26.6L14.2 31.4" strokeOpacity="0.4" />
        <path d="M25.4 26.6L33.8 31.4" strokeOpacity="0.4" />
      </g>

      {/* 身体与触角 */}
      <circle cx="24" cy="14.6" r="2" fill="#10294B" />
      <rect x="22.9" y="15.5" width="2.2" height="14" rx="1.1" fill="#10294B" />
      <path
        d="M24 18V25.4"
        stroke="#FFFFFF"
        strokeOpacity="0.3"
        strokeWidth="0.8"
        strokeLinecap="round"
      />
      <g stroke="#10294B" strokeWidth="1.1" strokeLinecap="round">
        <path d="M23.2 13C21.6 10.4 19.4 8.6 16.8 8" />
        <path d="M24.8 13C26.4 10.4 28.6 8.6 31.2 8" />
      </g>
      <circle cx="16.5" cy="7.8" r="1" fill="#10294B" />
      <circle cx="31.5" cy="7.8" r="1" fill="#10294B" />

      {/* 翼尖星芒 */}
      <path
        d="M38.6 5.4L39.5 7.9L42 8.8L39.5 9.7L38.6 12.2L37.7 9.7L35.2 8.8L37.7 7.9Z"
        fill="#FFFFFF"
        fillOpacity="0.9"
      />
    </svg>
  );
}
