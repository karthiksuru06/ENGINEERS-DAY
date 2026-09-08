"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Brand } from "@/components/brand";
import { Pill } from "@/components/pill";
import { ThemeToggle } from "@/components/theme-toggle";

function AuthLayout({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <div className="noise grid min-h-[100dvh] bg-background lg:grid-cols-[.9fr_1.1fr]">
      {/* Left panel */}
      <div className="hidden grid-texture items-end border-r border-border p-12 lg:flex">
        <div>
          <Brand />
          <div className="mt-auto pt-[50vh]">
            <Pill tone="cyan">ED26 / campus control room</Pill>
            <p className="mt-5 max-w-md font-display text-4xl font-semibold leading-tight">
              Make something worth remembering.
            </p>
          </div>
        </div>
      </div>
      {/* Right panel */}
      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Brand />
            <Link href="/" className="text-xs text-muted-foreground" data-testid="link-auth-home">
              Back home
            </Link>
          </div>
          <div className="mb-8 hidden lg:block">
            <Link
              href="/"
              className="text-xs text-muted-foreground hover:text-foreground"
              data-testid="link-auth-back"
            >
              ← Back to home
            </Link>
          </div>
          <div>
            <p className="mono text-[10px] uppercase tracking-[.24em] text-primary">{eyebrow}</p>
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    // Fetch role to redirect
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      const role = profile?.role ?? "STUDENT";
      if (role === "ADMIN" || role === "SUPER_ADMIN") router.push("/admin");
      else if (role === "VOLUNTEER" || role === "EVENT_COORDINATOR") router.push("/operations");
      else router.push("/dashboard");
    }
    setLoading(false);
  };

  return (
    <AuthLayout eyebrow="Sign in / return to the grid">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-4xl font-semibold">
          Welcome back
          <br />
          <span className="text-primary">to the grid.</span>
        </h1>
        <ThemeToggle />
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        Sign in with your college email and password.
      </p>
      <form onSubmit={handleLogin} className="mt-7 space-y-4">
        <div>
          <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Email
          </label>
          <div className="mt-1.5">
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@college.edu"
              className="auth-input"
              data-testid="input-login-email"
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Password
            </label>
            <Link href="#" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="mt-1.5">
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="auth-input"
              data-testid="input-login-password"
            />
          </div>
        </div>
        {error && (
          <p className="text-sm text-destructive" data-testid="status-login-error">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
          data-testid="button-login-submit"
        >
          {loading ? "Signing in…" : <>Enter control room <ArrowRight size={16} /></>}
        </button>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          New here?{" "}
          <Link href="/register" className="font-semibold text-primary" data-testid="link-login-register">
            Issue an XPass
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
