import { cn } from "@/lib/utils";
import { RefreshCw, ShieldCheck, Target } from "lucide-react";

export function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <p className="mono mb-2 text-[10px] uppercase tracking-[.24em] text-primary">{eyebrow}</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function LoadingBlock({ lines = 4 }: { lines?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className={cn(
            "h-4 rounded bg-muted",
            index === 0 && "w-2/5",
            index === 1 && "w-4/5",
            index > 1 && "w-3/5"
          )}
        />
      ))}
    </div>
  );
}

export function StateCard({
  kind,
  onRetry,
}: {
  kind: "loading" | "error" | "empty";
  onRetry?: () => void;
}) {
  if (kind === "loading")
    return (
      <div className="rounded-xl border border-card-border bg-card p-6">
        <LoadingBlock />
      </div>
    );
  if (kind === "error")
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
        <ShieldCheck className="mx-auto mb-3 text-destructive" size={24} />
        <p className="font-display font-semibold">We couldn&apos;t load this page</p>
        <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
            data-testid="button-retry"
          >
            <RefreshCw size={14} /> Try again
          </button>
        )}
      </div>
    );
  return (
    <div className="rounded-xl border border-dashed border-card-border bg-card/40 p-10 text-center">
      <Target className="mx-auto mb-3 text-muted-foreground" size={24} />
      <p className="font-display font-semibold">Nothing here yet</p>
      <p className="mt-1 text-sm text-muted-foreground">New updates will show up here as the day unfolds.</p>
    </div>
  );
}

export function StatCard({
  label,
  value,
  detail,
  icon,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-card-border bg-card p-5">
      <div
        className={cn(
          "mb-7 flex h-8 w-8 items-center justify-center rounded-md",
          accent === "orange" && "bg-primary/15 text-primary",
          accent === "cyan" && "bg-cyan-400/10 text-cyan-300",
          accent === "violet" && "bg-violet-400/10 text-violet-300",
          accent === "yellow" && "bg-yellow-400/10 text-yellow-300"
        )}
      >
        {icon}
      </div>
      <div className="mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}
