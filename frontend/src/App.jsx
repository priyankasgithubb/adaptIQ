
import { useState } from "react";

const days = [
  { day: "MON", height: 44 },
  { day: "TUE", height: 78 },
  { day: "WED", height: 55 },
  { day: "THU", height: 92 },
  { day: "FRI", height: 66 },
  { day: "SAT", height: 38 },
  { day: "SUN", height: 52 },
];

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-espresso text-xl font-bold text-cream">
        a<span className="text-coral">.</span>
      </div>
      <span className="text-[21px] font-bold tracking-[-0.06em] text-espresso">
        adapt<span className="text-coral">IQ</span>
      </span>
    </div>
  );
}

function PlannerPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[420px]">
      <div className="rounded-[25px] border border-white/10 bg-[#46342E] p-5 shadow-[0_30px_80px_rgba(24,14,11,0.27)] sm:p-7">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#B9A9A0]">
              Weekly overview
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-white">
              Your study rhythm
            </h3>
          </div>
          <div className="rounded-full bg-[#6A5147] px-3 py-1.5 text-xs text-[#F1D8CB]">
            This week
          </div>
        </div>

        <div className="mt-9 flex h-36 items-end justify-between gap-3">
          {days.map(({ day, height }, index) => (
            <div
              key={day}
              className="flex h-full flex-1 flex-col items-center justify-end gap-3"
            >
              <div className="flex h-full w-full items-end justify-center rounded-lg bg-white/5 p-1">
                <div
                  className={`w-full rounded-[5px] ${
                    index === 3 ? "bg-coral" : "bg-[#BBA497]"
                  }`}
                  style={{ height: `${height}%` }}
                />
              </div>
              <span className="text-[9px] font-semibold tracking-wider text-[#CBBAB0]">
                {day}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-8 border-t border-white/10 pt-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-white">
              Coming up
            </p>
            <span className="text-xs text-[#C6ADA0]">
              Sample schedule
            </span>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-[#5A443A] p-3">
            <div className="h-11 w-1 rounded-full bg-coral" />
            <div className="flex-1">
              <p className="text-sm font-medium text-white">
                Mathematics
              </p>
              <p className="mt-1 text-xs text-[#D3BDB0]">
                Focus session · 45 min
              </p>
            </div>
            <div className="rounded-lg bg-[#74584C] px-2.5 py-1.5 text-xs text-white">
              10:00
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-5 -right-3 rounded-2xl border border-[#E9D6C9] bg-[#FFF8F1] px-5 py-4 shadow-xl sm:-right-6">
        <p className="text-xs text-[#877066]">Your progress</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-2xl font-bold text-espresso">+24%</span>
          <span className="text-xs text-[#866F63]">Demo data</span>
        </div>
      </div>
    </div>
  );
}

function AuthField({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-semibold text-espresso">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className="w-full rounded-xl border border-[#DED5CD] bg-white px-4 py-3.5 text-[14px] text-espresso outline-none transition placeholder:text-[#ADA19A] focus:border-coral focus:ring-2 focus:ring-coral/20"
      />
    </label>
  );
}

export default function App() {
  const [mode, setMode] = useState("login");

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const isRegister = mode === "register";

  function update(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setForm({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    });
  }

  return (
    <div className="min-h-screen bg-cream lg:grid lg:grid-cols-[1fr_1fr]">
      {/* Left: brand and product preview */}
      <aside className="relative hidden min-h-screen flex-col overflow-hidden bg-espresso px-12 py-10 lg:flex xl:px-20">
        <div className="pointer-events-none absolute -left-40 top-32 h-[450px] w-[450px] rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -left-24 top-48 h-[320px] w-[320px] rounded-full border border-white/10" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-coral text-xl font-bold text-espresso">
            a.
          </div>
          <span className="text-[21px] font-bold tracking-[-0.06em] text-white">
            adapt<span className="text-coral">IQ</span>
          </span>
        </div>

        <div className="relative z-10 my-auto py-16">
          <div className="mb-10 max-w-lg">
            <div className="mb-6 inline-flex rounded-full border border-[#75594E] px-4 py-2 text-xs font-semibold tracking-wide text-[#F1B5A6]">
              A SMARTER WAY TO STUDY
            </div>

            <h1 className="max-w-[520px] text-[clamp(42px,4.4vw,67px)] font-semibold leading-[1.07] tracking-[-0.065em] text-[#FBF5EF]">
              Make room for
              <br />
              what <span className="font-serif italic text-coral">matters.</span>
            </h1>

            <p className="mt-6 max-w-[410px] text-[15px] leading-7 text-[#D0BCB1]">
              An adaptive study workspace that turns your goals,
              available time, and progress into a plan that works
              around your life.
            </p>
          </div>

          <PlannerPreview />
        </div>

        <div className="relative z-10 flex justify-between text-xs text-[#A89185]">
          <span>© AdaptIQ</span>
          <span>Plan with intention.</span>
        </div>
      </aside>

      {/* Right: authentication */}
      <main className="flex min-h-screen flex-col px-6 py-7 sm:px-12 lg:px-14 xl:px-24">
        <div className="flex items-center justify-between">
          <div className="lg:hidden">
            <BrandMark />
          </div>

          <div className="ml-auto text-[13px] text-muted">
            {isRegister ? "Already have an account?" : "New here?"}
            <button
              type="button"
              onClick={() => changeMode(isRegister ? "login" : "register")}
              className="ml-2 font-semibold text-espresso underline decoration-coral decoration-2 underline-offset-4"
            >
              {isRegister ? "Sign in" : "Create account"}
            </button>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-[410px] flex-1 flex-col justify-center py-14">
          <div className="mb-9">
            <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#AE7E6C]">
              {isRegister ? "GET STARTED" : "WELCOME BACK"}
            </span>

            <h2 className="mt-3 text-[clamp(32px,3vw,42px)] font-semibold tracking-[-0.055em] text-espresso">
              {isRegister ? "Start your journey." : "Pick up where you left off."}
            </h2>

            <p className="mt-3 text-sm leading-6 text-muted">
              {isRegister
                ? "Create your learning space and start building better study habits."
                : "Sign in to continue building a study routine that fits you."}
            </p>
          </div>

          <div className="space-y-5">
            {isRegister && (
              <AuthField
                label="Full name"
                value={form.name}
                onChange={(value) => update("name", value)}
                placeholder="Your full name"
                autoComplete="name"
              />
            )}

            <AuthField
              label="Email address"
              type="email"
              value={form.email}
              onChange={(value) => update("email", value)}
              placeholder="you@example.com"
              autoComplete="email"
            />

            <AuthField
              label="Password"
              type="password"
              value={form.password}
              onChange={(value) => update("password", value)}
              placeholder="Enter your password"
              autoComplete={isRegister ? "new-password" : "current-password"}
            />

            {isRegister && (
              <AuthField
                label="Confirm password"
                type="password"
                value={form.confirmPassword}
                onChange={(value) => update("confirmPassword", value)}
                placeholder="Confirm your password"
                autoComplete="new-password"
              />
            )}

            <button
              type="button"
              disabled
              title="Backend authentication connection is the next step"
              className="mt-3 w-full cursor-not-allowed rounded-xl bg-espresso px-5 py-4 text-[14px] font-semibold text-white opacity-70"
            >
              {isRegister ? "Create account" : "Sign in"}
            </button>

            <p className="text-center text-xs leading-5 text-muted">
              Authentication UI preview — API connection is next.
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-[#A4988E]">
          A little structure. A lot more clarity.
        </p>
      </main>
    </div>
  );
}
