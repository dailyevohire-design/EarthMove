import type { CSSProperties } from "react";

type LogoVariant = "lockup" | "wordmark" | "mark";
type LogoTheme = "positive" | "reverse";

interface LogoProps {
  /** Wordmark font-size in px. Default 110 (hero). 60 for site header, 32 for inline. */
  size?: number;
  /** lockup = mark + wordmark + tagline · wordmark = mark + wordmark · mark = cascade alone */
  variant?: LogoVariant;
  /** positive = evergreen on cream surfaces · reverse = cream on evergreen surfaces */
  theme?: LogoTheme;
  /** Override the tagline text. Default: "intelligence behind every load." */
  tagline?: string;
  className?: string;
}

const EVERGREEN = "#0E2A22";
const CREAM = "#F5F1E8";

export function Logo({
  size = 110,
  variant = "lockup",
  theme = "positive",
  tagline = "intelligence behind every load.",
  className,
}: LogoProps) {
  const fg = theme === "positive" ? EVERGREEN : CREAM;
  const isMarkOnly = variant === "mark";
  const cascadeWidth = isMarkOnly ? Math.round((size * 72) / 78) : Math.round(size * 0.655);
  const cascadeHeight = isMarkOnly ? size : Math.round(size * 0.71);
  const taglineSize = +(size * 0.2).toFixed(1);
  const taglineGap = Math.round(size * 0.22);
  const rtRelief = Math.max(1, Math.round(size * 0.027));
  const cascadeMargin = -Math.max(1, Math.round(size * 0.009));

  const wordmarkStyle: CSSProperties = {
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    fontSize: `${size}px`,
    fontWeight: 500,
    color: fg,
    letterSpacing: "-0.05em",
    lineHeight: 1,
  };

  const cascade = (
    <svg
      width={cascadeWidth}
      height={cascadeHeight}
      viewBox="0 0 72 78"
      style={{ display: "block", flexShrink: 0 }}
      aria-hidden="true"
    >
      <path d="M0 0 L64 0 L72 6 L64 12 L0 12 Z" fill={fg} />
      <path d="M0 33 L46 33 L54 39 L46 45 L0 45 Z" fill={fg} />
      <path d="M0 66 L64 66 L72 72 L64 78 L0 78 Z" fill={fg} />
    </svg>
  );

  if (variant === "mark") {
    return (
      <span
        className={className}
        role="img"
        aria-label="Earthmove"
        style={{ display: "inline-flex" }}
      >
        {cascade}
      </span>
    );
  }

  const wordmark = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
      {cascade}
      <span style={{ ...wordmarkStyle, marginLeft: cascadeMargin }}>ar</span>
      <span style={{ ...wordmarkStyle, marginLeft: rtRelief }}>thmove</span>
    </span>
  );

  if (variant === "wordmark") {
    return (
      <span
        className={className}
        role="img"
        aria-label="Earthmove"
        style={{ display: "inline-flex" }}
      >
        {wordmark}
      </span>
    );
  }

  return (
    <span
      className={className}
      role="img"
      aria-label={`Earthmove. ${tagline}`}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {wordmark}
      <span
        style={{
          marginTop: taglineGap,
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontStyle: "italic",
          fontSize: `${taglineSize}px`,
          color: fg,
          letterSpacing: "0.005em",
          whiteSpace: "nowrap",
        }}
      >
        {tagline}
      </span>
    </span>
  );
}
