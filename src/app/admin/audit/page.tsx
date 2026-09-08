"use client";

import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StateCard } from "@/components/ui-primitives";
import { getAuditLogs } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<Awaited<ReturnType<typeof getAuditLogs>>>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).single();
        setUserName(p?.full_name ?? "");
        setUserRole(p?.role ?? "ADMIN");
      }
      const data = await getAuditLogs({ limit: 100 });
      setLogs(data);
      setLoading(false);
    }
    init();
  }, []);

  return (
    <AppShell userName={userName} userRole={userRole}>
      <div className="animate-rise">
        <div className="mb-6">
          <p className="mono text-[10px] uppercase tracking-[.24em] text-primary">Admin / Audit</p>
          <h1 className="mt-2 font-display text-3xl font-semibold">Audit log.</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All administrative mutations. Immutable.
          </p>
        </div>

        {loading ? (
          <StateCard kind="loading" />
        ) : logs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-card-border bg-card/40 p-12 text-center">
            <ClipboardList size={32} className="mx-auto mb-3 text-muted-foreground" />
            <p className="font-display font-semibold">No audit events yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Administrative actions will appear here.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-card-border bg-card overflow-hidden">
            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 border-b border-border px-5 py-3 text-[10px] mono uppercase tracking-wider text-muted-foreground">
              <span>Actor</span>
              <span>Action</span>
              <span>Entity</span>
              <span>When</span>
            </div>
            {(logs as {
              id: string;
              actor_id: string | null;
              action: string;
              entity_type: string;
              entity_id: string | null;
              note: string | null;
              created_at: string;
              profiles: { full_name: string } | null;
            }[]).map((log) => {
              const actor = Array.isArray(log.profiles) ? (log.profiles as { full_name: string }[])[0] : log.profiles;
              return (
                <div
                  key={log.id}
                  className="grid grid-cols-[auto_1fr_auto_auto] gap-4 border-b border-border/50 px-5 py-3.5 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
                      {(actor?.full_name ?? "?").charAt(0)}
                    </div>
                    <span className="text-xs font-medium">{actor?.full_name ?? "System"}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="mono truncate text-xs font-semibold text-primary">{log.action}</div>
                    {log.note && <div className="truncate text-xs text-muted-foreground">{log.note}</div>}
                  </div>
                  <div className="mono text-[10px] text-muted-foreground whitespace-nowrap">
                    {log.entity_type}
                  </div>
                  <div className="mono text-[10px] text-muted-foreground whitespace-nowrap">
                    {new Date(log.created_at).toLocaleDateString("en-IN", {
                      day: "2-digit", month: "short",
                    })}{" "}
                    {new Date(log.created_at).toLocaleTimeString("en-IN", {
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
