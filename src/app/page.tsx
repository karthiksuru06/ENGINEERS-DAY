import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Pill } from "@/components/pill";
import { Brand } from "@/components/brand";

export const metadata = {
  title: "Engineer's Day 2026 | Build something that matters",
  description:
    "Find events, meet teammates, earn points, and make a day of building, competing, creating, and connecting across campus.",
};

export default function HomePage() {
  return (
    <div className="noise min-h-[100dvh] overflow-hidden bg-background text-foreground">
      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-12">
        <Brand />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="hidden px-3 py-2 text-sm text-muted-foreground hover:text-foreground sm:block"
            data-testid="link-home-login"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5"
            data-testid="link-home-register"
          >
            Get your XPass <ArrowRight className="ml-1 inline" size={15} />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto grid min-h-[calc(100dvh-78px)] max-w-[1400px] items-center gap-12 px-6 pb-20 pt-14 md:grid-cols-[1.08fr_.92fr] md:px-12 md:pt-0">
        <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-0 top-16 h-64 w-64 rounded-full bg-cyan-400/5 blur-3xl" />

        {/* Left column */}
        <div className="relative animate-rise">
          <Pill tone="orange">
            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
            Engineer&apos;s Day / 2026
          </Pill>
          <h1 className="mt-7 max-w-3xl font-display text-[clamp(3.2rem,8vw,7.6rem)] font-semibold leading-[.88] tracking-[-.075em]">
            Build something
            <br />
            <span className="text-primary">that matters.</span>
          </h1>
          <p className="mt-8 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Find events, meet teammates, and make a day of building, competing, creating, and
            connecting across campus.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="group rounded-md bg-primary px-5 py-3.5 text-sm font-bold text-primary-foreground shadow-[5px_5px_0_hsl(190_78%_55%/.55)] transition-transform hover:-translate-y-1"
              data-testid="link-hero-register"
            >
              Get your XPass <ArrowRight className="ml-2 inline transition-transform group-hover:translate-x-1" size={16} />
            </Link>
            <Link
              href="/events"
              className="rounded-md border border-border bg-card px-5 py-3.5 text-sm font-semibold hover:border-primary/50"
              data-testid="link-hero-events"
            >
              See all events
            </Link>
          </div>
          <div className="mt-14 flex gap-8 border-t border-border pt-5">
            <div>
              <div className="font-display text-2xl font-semibold">18</div>
              <div className="mono text-[9px] uppercase tracking-wider text-muted-foreground">events</div>
            </div>
            <div>
              <div className="font-display text-2xl font-semibold">5K+</div>
              <div className="mono text-[9px] uppercase tracking-wider text-muted-foreground">participants</div>
            </div>
            <div>
              <div className="font-display text-2xl font-semibold">01–03</div>
              <div className="mono text-[9px] uppercase tracking-wider text-muted-foreground">august 2026</div>
            </div>
          </div>
        </div>

        {/* Right column — decorative card */}
        <div className="relative animate-rise [animation-delay:120ms]">
          <div className="grid-texture relative aspect-square max-w-[570px] overflow-hidden rounded-xl border border-border bg-card p-5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_24%,hsl(27_100%_57%/.2),transparent_32%),radial-gradient(circle_at_30%_80%,hsl(174_64%_43%/.12),transparent_28%)]" />
            <div className="relative flex items-center justify-between">
              <span className="mono text-[10px] text-muted-foreground">EVENTS / CAMPUS 01</span>
              <span className="flex items-center gap-1.5 mono text-[10px] text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                registration open
              </span>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative flex h-52 w-52 items-center justify-center rounded-full border border-primary/40">
                <div className="absolute inset-5 rounded-full border border-cyan-300/20" />
                <div className="absolute inset-12 rounded-full border border-primary/20" />
                <div className="h-24 w-24 rotate-45 border border-primary bg-primary/10 shadow-[0_0_55px_hsl(27_100%_57%/.25)]" />
                <span className="absolute mono text-xl font-medium text-primary">
                  ED<span className="text-foreground">26</span>
                </span>
              </div>
            </div>
            <div className="absolute bottom-5 left-5 right-5 grid grid-cols-3 gap-2">
              <div className="border border-border bg-background/75 p-3">
                <div className="mono text-[9px] text-muted-foreground">PARTICIPANTS</div>
                <div className="mt-1 font-display text-lg">2,482</div>
              </div>
              <div className="border border-border bg-background/75 p-3">
                <div className="mono text-[9px] text-muted-foreground">POINTS EARNED</div>
                <div className="mt-1 font-display text-lg text-primary">18.6K</div>
              </div>
              <div className="border border-border bg-background/75 p-3">
                <div className="mono text-[9px] text-muted-foreground">EVENTS TODAY</div>
                <div className="mt-1 font-display text-lg text-cyan-300">12</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-card/35 px-6 py-20 md:px-12">
        <div className="mx-auto max-w-[1300px]">
          <p className="mono text-[10px] uppercase tracking-[.25em] text-primary">How it works</p>
          <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-5">
            {[
              ["01", "REGISTER", "Tell us who you are."],
              ["02", "XPASS", "Keep your event pass handy."],
              ["03", "CHOOSE", "Pick the events you want."],
              ["04", "CHECK IN", "Show up and take part."],
              ["05", "EARN", "Collect points with your squad."],
            ].map(([number, title, copy]) => (
              <div key={number} className="bg-background p-6">
                <span className="mono text-xs text-primary">{number}</span>
                <h2 className="mt-10 font-display text-lg font-semibold">{title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
