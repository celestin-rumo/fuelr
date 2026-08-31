import type { ReactNode } from "react";
import { cn } from "@ui/cn";

/** Page-width container. 1240px max, margins per the responsive grid. */
export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1240px] px-5 md:px-10", className)}>
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
      {children}
    </div>
  );
}

/** Section heading block: eyebrow label, H2, and an optional lead paragraph. */
export function SectionHead({
  label,
  title,
  text,
  className,
}: {
  label?: string;
  title: string;
  text?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {label && <SectionLabel>{label}</SectionLabel>}
      <h2 className="font-display text-[22px] leading-[1.2] font-extrabold tracking-[-0.02em] text-text sm:text-[32px]">
        {title}
      </h2>
      {text && (
        <p className="max-w-[68ch] text-[15px] leading-[1.6] font-medium text-text-dim">
          {text}
        </p>
      )}
    </div>
  );
}

export function Section({
  children,
  className,
  muted = false,
}: {
  children: ReactNode;
  className?: string;
  muted?: boolean;
}) {
  return (
    <section
      className={cn("py-16 md:py-20", muted && "bg-bg-raised", className)}
    >
      <Container>{children}</Container>
    </section>
  );
}
