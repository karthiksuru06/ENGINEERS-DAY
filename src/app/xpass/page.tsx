"use client";

import { useEffect, useState } from "react";
import { Download, CheckCircle2, Users, QrCode } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SectionHeading, StateCard } from "@/components/ui-primitives";
import { getXPass, type XPass } from "@/lib/api";
import { shortDate, formatNumber, initials } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function QrVisual({ token }: { token: string }) {
  const pattern = Array.from(
    { length: 121 },
    (_, i) => ((i * 17 + token.length * 11 + Math.floor(i / 11) * 7) % 5) < 2
  );
  return (
    <div className="rounded-lg bg-[#f4efe5] p-4 shadow-[10px_10px_0_hsl(27_100%_57%/.35)]">
      <div className="grid h-44 w-44 grid-cols-11 gap-[2px]">
        {pattern.map((filled, i) => (
          <span key={i} className={filled ? "bg-[#17202a]" : "bg-transparent"} />
        ))}
      </div>
      <div className="mt-2 text-center font-mono text-[8px] tracking-[.18em] text-[#17202a]">
        ED26 / {token.slice(-8)}
      </div>
    </div>
  );
}

export default function XPassPage() {
  const [xpass, setXpass] = useState<XPass | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", user.id)
          .single();
        setUserName(profile?.full_name ?? "");
        setUserRole(profile?.role ?? "STUDENT");
      }
      const data = await getXPass();
      setXpass(data);
      setLoading(false);
    }
    load();
  }, []);

  const download = () => {
    if (!xpass) return;
    const blob = new Blob(
      [`ENGINEER'S DAY 2026\nXPASS: ${xpass.id}\nNAME: ${xpass.name}\nQR TOKEN: ${xpass.qrToken}`],
      { type: "text/plain" }
    );
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `xpass-${xpass.id}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <AppShell userName={userName} userRole={userRole}>
      <div className="animate-rise">
        <SectionHeading
          eyebrow="Your event pass"
          title="Your XPass."
          action={
            <button
              onClick={download}
              disabled={!xpass}
              className="flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-semibold hover:border-primary/50 disabled:opacity-50"
              data-testid="button-download-xpass"
            >
              <Download size={16} /> Download pass
            </button>
          }
        />

        {loading ? (
          <StateCard kind="loading" />
        ) : !xpass ? (
          <StateCard kind="error" />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_.8fr]">
            {/* Main pass card */}
            <div className="relative overflow-hidden rounded-xl border border-primary/35 bg-card p-6 md:p-9">
              <div
                className="absolute inset-0 opacity-60"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(27 100% 57%/.09), transparent 35%, hsl(174 64% 43%/.06))",
                }}
              />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="mono text-[10px] uppercase tracking-[.24em] text-primary">
                    Engineer&apos;s Day / entry pass
                  </p>
                  <h2 className="mt-5 font-display text-3xl font-semibold">{xpass.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {xpass.branch} · Year {xpass.year}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary font-display text-lg font-bold text-primary-foreground">
                  {initials(xpass.name)}
                </div>
              </div>
              <div className="my-10 flex justify-center">
                <QrVisual token={xpass.qrToken} />
              </div>
              <div className="relative grid grid-cols-2 gap-4 border-t border-border pt-5 sm:grid-cols-4">
                <Meta label="XPass ID" value={xpass.id} />
                <Meta label="Points" value={formatNumber(xpass.points)} />
                <Meta label="Position" value={`#${xpass.position}`} />
                <Meta label="Issued" value={shortDate(xpass.issuedAt)} />
              </div>
            </div>

            {/* Side cards */}
            <div className="space-y-6">
              <div className="rounded-xl border border-card-border bg-card p-6">
                <p className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Your interests
                </p>
                <div className="mt-5 space-y-3">
                  {xpass.identity?.map((item) => (
                    <div key={item} className="flex items-center gap-3 rounded-md bg-background p-3 text-sm">
                      <CheckCircle2 size={15} className="text-cyan-300" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-card-border bg-card p-6">
                <p className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Squad
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
                    <Users size={18} />
                  </div>
                  <div>
                    <div className="font-display font-semibold">{xpass.squad}</div>
                    <div className="text-xs text-muted-foreground">
                      Your points add to the squad total
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
