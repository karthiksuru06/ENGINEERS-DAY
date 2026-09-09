"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Zap, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StateCard } from "@/components/ui-primitives";
import { listStudents, formatNumber } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<ReturnType<typeof listStudents> extends Promise<infer T> ? T : never>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("");
  const [year, setYear] = useState("");
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");

  const load = useCallback(async (opts?: { search?: string; branch?: string; year?: string }) => {
    setLoading(true);
    try {
      const data = await listStudents({ search: opts?.search, branch: opts?.branch, year: opts?.year, limit: 50 });
      setStudents(data as unknown as typeof students);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).single();
        setUserName(profile?.full_name ?? "");
        setUserRole(profile?.role ?? "ADMIN");
      }
      await load();
    }
    init();
  }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load({ search, branch, year });
  };

  return (
    <AppShell userName={userName} userRole={userRole}>
      <div className="animate-rise">
        <div className="mb-6">
          <p className="mono text-[10px] uppercase tracking-[.24em] text-primary">Admin / Students</p>
          <h1 className="mt-2 font-display text-3xl font-semibold">All students.</h1>
        </div>

        {/* Filters */}
        <form onSubmit={handleSearch} className="mb-5 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name…"
              className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
              data-testid="input-admin-student-search"
            />
          </div>
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          >
            <option value="">All branches</option>
            {["Computer Science","Information Technology","Electronics & Communication","Electrical Engineering","Mechanical Engineering"].map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          >
            <option value="">All years</option>
            {["1","2","3","4"].map((y) => <option key={y}>Year {y}</option>)}
          </select>
          <button
            type="submit"
            className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            Filter
          </button>
        </form>

        {loading ? (
          <StateCard kind="loading" />
        ) : students.length === 0 ? (
          <StateCard kind="empty" />
        ) : (
          <div className="rounded-xl border border-card-border bg-card overflow-hidden">
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 border-b border-border px-5 py-3 text-[10px] mono uppercase tracking-wider text-muted-foreground">
              <span>#</span>
              <span>Student</span>
              <span>Branch</span>
              <span>XP</span>
              <span />
            </div>
            {(students as {
              id: string;
              full_name: string;
              college_id: string | null;
              branch: string | null;
              year: string | null;
              email: string | null;
              created_at: string;
              xpasses: { total_points: number; xpass_id: string; identity_tags: string[] }[] | null;
            }[]).map((s, i) => {
              const xp = Array.isArray(s.xpasses) ? s.xpasses[0] : s.xpasses;
              return (
                <div
                  key={s.id}
                  className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 border-b border-border/50 px-5 py-3.5 last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <span className="mono text-xs text-muted-foreground w-6">{i + 1}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
                        {s.full_name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-sm">{s.full_name}</div>
                        <div className="mono text-[10px] text-muted-foreground">{s.college_id ?? "—"}</div>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {s.branch ?? "—"} · Y{s.year ?? "?"}
                  </div>
                  <div className="flex items-center gap-1">
                    <Zap size={12} className="text-primary" />
                    <span className="font-display font-semibold text-sm">{formatNumber(xp?.total_points ?? 0)}</span>
                  </div>
                  <ChevronRight size={15} className="text-muted-foreground" />
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground mono">
          Showing up to 50 results. Use filters to narrow down.
        </p>
      </div>
    </AppShell>
  );
}
