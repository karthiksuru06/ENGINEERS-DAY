import Link from "next/link";
import { Brand } from "@/components/brand";

export default function NotFound() {
  return (
    <div className="noise flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6 text-center">
      <Brand />
      <div className="mt-16">
        <p className="mono text-[10px] uppercase tracking-[.25em] text-primary">Error / 404</p>
        <h1 className="mt-6 font-display text-7xl font-semibold leading-[.9] tracking-[-.05em] md:text-9xl">
          Off the
          <br />
          <span className="text-primary">grid.</span>
        </h1>
        <p className="mt-8 max-w-sm text-sm leading-relaxed text-muted-foreground">
          This page doesn&apos;t exist. Maybe the event wrapped up, or you followed a bad token.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="rounded-md bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:brightness-110"
          >
            Back to home
          </Link>
          <Link
            href="/events"
            className="rounded-md border border-border px-5 py-3 text-sm font-semibold hover:border-primary/50"
          >
            Browse events
          </Link>
        </div>
      </div>
    </div>
  );
}
