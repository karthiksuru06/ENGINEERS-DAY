"use client";

import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { Plus, Gift, Power, PowerOff, Eye, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StateCard } from "@/components/ui-primitives";
import { getAdminRewards, createReward, toggleReward, type Reward } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";

function RewardCard({
  reward,
  onToggle,
  onViewQR,
}: {
  reward: Reward;
  onToggle: (id: string, active: boolean) => void;
  onViewQR: (reward: Reward) => void;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${reward.isActive ? "border-card-border bg-card" : "border-card-border bg-card/40 opacity-60"}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/12 text-xl">
            🎁
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{reward.name}</h3>
              <span
                className={`mono rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wider ${reward.isActive ? "bg-emerald-500/12 text-emerald-400" : "bg-muted text-muted-foreground"}`}
              >
                {reward.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            {reward.description && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {reward.description}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                +{formatNumber(reward.xpValue)} XP
              </span>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                {reward.currentRedemptions}
                {reward.maxRedemptions ? `/${reward.maxRedemptions}` : ""}{" "}
                redeemed
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => onViewQR(reward)}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:border-primary/50"
            data-testid={`button-view-reward-qr-${reward.id}`}
          >
            <Eye size={13} /> QR
          </button>
          <button
            onClick={() => onToggle(reward.id, !reward.isActive)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold ${reward.isActive ? "border-destructive/30 text-destructive hover:bg-destructive/8" : "border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/8"}`}
            data-testid={`button-toggle-reward-${reward.id}`}
          >
            {reward.isActive ? (
              <>
                <PowerOff size={13} /> Deactivate
              </>
            ) : (
              <>
                <Power size={13} /> Activate
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function QRModal({
  reward,
  onClose,
}: {
  reward: Reward;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-card-border bg-card p-6 text-center">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{reward.name}</h2>
          <button onClick={onClose} className="text-muted-foreground">
            <X size={20} />
          </button>
        </div>
        <p className="mb-5 text-sm text-muted-foreground">
          +{formatNumber(reward.xpValue)} XP · Students scan this QR to redeem
        </p>
        <div className="mx-auto w-fit rounded-xl bg-white p-4">
          <QRCode value={reward.qrToken ?? ""} size={200} />
        </div>
        <div className="mt-4 text-center text-xs text-muted-foreground break-all">
          {reward.qrToken ?? "No QR Token"}
        </div>
        <div className="mt-3 rounded-lg bg-yellow-400/8 border border-yellow-400/20 px-3 py-2 text-xs text-yellow-300">
          Never expose this QR publicly until the reward window opens.
        </div>
      </div>
    </div>
  );
}

function CreateRewardModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    xpValue: 25,
    maxRedemptions: 0,
    validFrom: "",
    validUntil: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await createReward({
        name: form.name,
        description: form.description || undefined,
        xpValue: form.xpValue,
        maxRedemptions: form.maxRedemptions > 0 ? form.maxRedemptions : undefined,
        validFrom: form.validFrom || undefined,
        validUntil: form.validUntil || undefined,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create reward");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-card-border bg-card p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Create reward</h2>
          <button onClick={onClose} className="text-muted-foreground">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Reward name</label>
            <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="auth-input mt-1.5" placeholder="e.g. Early Bird Bonus" />
          </div>
          <div>
            <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Description</label>
            <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="auth-input mt-1.5" placeholder="Optional description" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground">XP value</label>
              <input type="number" min={1} value={form.xpValue} onChange={(e) => setForm((f) => ({ ...f, xpValue: +e.target.value }))} className="auth-input mt-1.5" />
            </div>
            <div>
              <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Max redemptions (0=unlimited)</label>
              <input type="number" min={0} value={form.maxRedemptions} onChange={(e) => setForm((f) => ({ ...f, maxRedemptions: +e.target.value }))} className="auth-input mt-1.5" />
            </div>
            <div>
              <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Valid from</label>
              <input type="datetime-local" value={form.validFrom} onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))} className="auth-input mt-1.5" />
            </div>
            <div>
              <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Valid until</label>
              <input type="datetime-local" value={form.validUntil} onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))} className="auth-input mt-1.5" />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60">
            {loading ? "Creating…" : <><Gift size={16} /> Create reward + QR</>}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminRewardsPage() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [qrReward, setQrReward] = useState<Reward | null>(null);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");

  async function load() {
    const data = await getAdminRewards();
    setRewards(data);
    setLoading(false);
  }

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).single();
        setUserName(p?.full_name ?? "");
        setUserRole(p?.role ?? "ADMIN");
      }
      load();
    }
    init();
  }, []);

  const handleToggle = async (id: string, active: boolean) => {
    await toggleReward(id, active);
    load();
  };

  return (
    <AppShell userName={userName} userRole={userRole}>
      <div className="animate-rise">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="mono text-[10px] uppercase tracking-[.24em] text-primary">Admin / Rewards</p>
            <h1 className="mt-2 font-display text-3xl font-semibold">Rewards.</h1>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
            data-testid="button-create-reward"
          >
            <Plus size={15} /> Create reward
          </button>
        </div>
        {loading ? <StateCard kind="loading" /> : rewards.length === 0 ? (
          <StateCard kind="empty" />
        ) : (
          <div className="space-y-3">
            {rewards.map((r) => (
              <RewardCard key={r.id} reward={r} onToggle={handleToggle} onViewQR={setQrReward} />
            ))}
          </div>
        )}
      </div>
      {showCreate && <CreateRewardModal onClose={() => setShowCreate(false)} onCreated={load} />}
      {qrReward && <QRModal reward={qrReward} onClose={() => setQrReward(null)} />}
    </AppShell>
  );
}
