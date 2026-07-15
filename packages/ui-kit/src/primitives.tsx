import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { T } from "./tokens.js";

export function Card({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: T.surf,
        border: `1px solid ${T.white5}`,
        borderRadius: 10,
        padding: 20,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Button({
  variant = "primary",
  style,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  const base: React.CSSProperties = {
    borderRadius: 8,
    padding: "10px 16px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    border: "1px solid transparent",
  };
  const byVariant: Record<string, React.CSSProperties> = {
    primary: { background: T.brand, color: T.white, borderColor: T.brand },
    secondary: { background: T.surf2, color: T.white, borderColor: T.white5 },
    ghost: { background: "transparent", color: T.white3, borderColor: "transparent" },
  };
  return <button style={{ ...base, ...byVariant[variant], ...style }} {...rest} />;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        background: T.surf2,
        border: `1px solid ${T.white5}`,
        borderRadius: 8,
        padding: "10px 12px",
        color: T.white,
        fontSize: 14,
        width: "100%",
        ...props.style,
      }}
    />
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "green" | "red" | "amber" }) {
  const tones: Record<string, { bg: string; fg: string }> = {
    neutral: { bg: T.white6, fg: T.white3 },
    green: { bg: T.greenBg, fg: T.greenT },
    red: { bg: T.redBg, fg: T.redT },
    amber: { bg: T.amberBg, fg: T.amberT },
  };
  const c = tones[tone]!;
  return (
    <span style={{ background: c.bg, color: c.fg, borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>
      {children}
    </span>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px", color: T.white3 }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: T.white2, marginBottom: 6 }}>{title}</div>
      {hint ? <div style={{ fontSize: 13 }}>{hint}</div> : null}
    </div>
  );
}
