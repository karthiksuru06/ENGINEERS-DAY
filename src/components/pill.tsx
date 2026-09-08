import { cn } from "@/lib/utils";

export function Pill({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "orange" | "cyan" | "green";
}) {
  const tones = {
    muted: "border-border bg-muted text-muted-foreground",
    orange: "border-primary/35 bg-primary/10 text-primary",
    cyan: "border-cyan-400/25 bg-cyan-400/10 text-cyan-200",
    green: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 mono text-[10px] uppercase tracking-wider",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}
