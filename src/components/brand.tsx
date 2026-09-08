import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className={`flex items-center gap-3 group${compact ? " justify-center" : ""}`}
      data-testid="link-brand"
    >
      <span className="relative flex h-9 w-9 items-center justify-center rounded-sm bg-primary text-primary-foreground font-display font-bold text-lg shadow-[4px_4px_0_hsl(190_78%_55%/.35)]">
        E
      </span>
      {!compact && (
        <span>
          <span className="font-display text-base font-bold tracking-tight text-foreground block leading-none">
            ENGINEER&apos;S DAY
          </span>
          <span className="mono text-[9px] tracking-[.24em] text-primary">EVENT HUB / 26</span>
        </span>
      )}
    </Link>
  );
}
