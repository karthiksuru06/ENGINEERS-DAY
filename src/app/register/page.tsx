"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createStudentRegistration } from "@/lib/api";
import { Brand } from "@/components/brand";
import { Pill } from "@/components/pill";

function AuthLayout({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <div className="noise grid min-h-[100dvh] bg-background lg:grid-cols-[.9fr_1.1fr]">
      <div className="hidden grid-texture items-end border-r border-border p-12 lg:flex">
        <div>
          <Brand />
          <div className="mt-auto pt-[50vh]">
            <Pill tone="cyan">ED26 / campus control room</Pill>
            <p className="mt-5 max-w-md font-display text-4xl font-semibold leading-tight">
              Put your name on the board.
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Brand />
            <Link href="/" className="text-xs text-muted-foreground">
              Back home
            </Link>
          </div>
          <div className="mb-8 hidden lg:block">
            <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    collegeId: "",
    branch: "Computer Science",
    year: "2",
    whatsapp: "",
    identity: ["Student"],
    interests: ["BUILD"],
    squadChoice: "skip" as "create" | "join" | "skip",
  });

  const update = (key: keyof typeof form, value: string) =>
    setForm((curr) => ({ ...curr, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      // Sign up
      const { error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      });
      if (signUpError) throw signUpError;
      // Create profile and xpass
      await createStudentRegistration(form);
      router.push("/xpass");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout eyebrow="Registration / issue your identity">
      <h1 className="font-display text-4xl font-semibold">
        Put your name
        <br />
        <span className="text-primary">on the board.</span>
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        One form. One XPass. Every event in Engineer&apos;s Day starts here.
      </p>
      <form onSubmit={submit} className="mt-7 space-y-4">
        <Field label="Full name">
          <input
            required
            minLength={2}
            value={form.fullName}
            onChange={(e) => update("fullName", e.target.value)}
            placeholder="Your name"
            className="auth-input"
            data-testid="input-register-name"
          />
        </Field>
        <Field label="College ID">
          <input
            required
            minLength={2}
            value={form.collegeId}
            onChange={(e) => update("collegeId", e.target.value)}
            placeholder="eg. 24CSE041"
            className="auth-input"
            data-testid="input-register-college"
          />
        </Field>
        <Field label="Email">
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="you@college.edu"
            className="auth-input"
            data-testid="input-register-email"
          />
        </Field>
        <Field label="Password">
          <input
            required
            type="password"
            minLength={6}
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            placeholder="min 6 characters"
            className="auth-input"
            data-testid="input-register-password"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Branch">
            <select
              value={form.branch}
              onChange={(e) => update("branch", e.target.value)}
              className="auth-input"
              data-testid="select-register-branch"
            >
              <option>Computer Science</option>
              <option>Electronics</option>
              <option>Mechanical</option>
              <option>Civil</option>
            </select>
          </Field>
          <Field label="Year">
            <select
              value={form.year}
              onChange={(e) => update("year", e.target.value)}
              className="auth-input"
              data-testid="select-register-year"
            >
              <option>1</option>
              <option>2</option>
              <option>3</option>
              <option>4</option>
            </select>
          </Field>
        </div>
        <Field label="WhatsApp number">
          <input
            required
            value={form.whatsapp}
            onChange={(e) => update("whatsapp", e.target.value)}
            placeholder="+91 00000 00000"
            className="auth-input"
            data-testid="input-register-whatsapp"
          />
        </Field>
        <div>
          <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Squad plan
          </label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(["create", "join", "skip"] as const).map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => setForm((curr) => ({ ...curr, squadChoice: item }))}
                className={`rounded-md border p-2.5 text-xs font-semibold capitalize ${
                  form.squadChoice === item
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground"
                }`}
                data-testid={`button-squad-${item}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        {error && (
          <p className="text-sm text-destructive" data-testid="status-registration-form-error">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
          data-testid="button-submit-registration"
        >
          {loading ? "Issuing XPass…" : <>Issue my XPass <ArrowRight size={16} /></>}
        </button>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-primary">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
