"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* LEFT PANEL — 55% dark navy */}
      <div
        className="relative hidden md:flex flex-col items-center justify-center overflow-hidden"
        style={{ width: "55%", background: "#283044" }}
      >
        {/* Radial gradient orbs */}
        <div
          className="pointer-events-none absolute"
          style={{
            width: 600,
            height: 600,
            top: -120,
            left: -100,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(48,82,255,0.18) 0%, transparent 70%)",
          }}
        />
        <div
          className="pointer-events-none absolute"
          style={{
            width: 500,
            height: 500,
            bottom: -160,
            right: -80,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(48,82,255,0.12) 0%, transparent 70%)",
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center px-8">
          {/* Brand chevron */}
          <div className="relative mb-12 flex items-center justify-center" style={{ width: 200, height: 200 }}>
            <div
              className="absolute"
              style={{ inset: 0, borderRadius: "50%", border: "2px solid rgba(48,82,255,0.25)" }}
            />
            <div
              className="absolute"
              style={{ top: 25, left: 25, width: 150, height: 150, borderRadius: "50%", border: "2px solid rgba(48,82,255,0.35)" }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/chevron-white.svg"
              alt="Coastal CRM"
              style={{ width: 92, height: "auto", position: "relative", zIndex: 1 }}
            />
          </div>

          {/* Brand name */}
          <h1
            className="font-sans font-extrabold text-white"
            style={{ fontSize: "2.5rem", letterSpacing: "-0.02em", marginBottom: "0.75rem" }}
          >
            Coastal CRM
          </h1>

          {/* Tagline */}
          <p
            className="font-body font-normal"
            style={{ fontSize: "1.05rem", color: "#bbc3ff", letterSpacing: "0.01em" }}
          >
            Debt Settlement Intelligence Platform
          </p>

          {/* Wave bar */}
          <div className="flex items-end gap-1 mt-10">
            {[16, 28, 40, 32, 48, 36, 24, 44, 20, 32, 12].map((h, i) => (
              <span
                key={i}
                style={{
                  display: "block",
                  width: 4,
                  height: h,
                  borderRadius: 2,
                  background: i === 4 ? "rgba(48,82,255,0.55)" : "rgba(48,82,255,0.35)",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL — 45% white */}
      <div
        className="flex flex-1 md:flex-none items-center justify-center bg-white"
        style={{ width: "45%" }}
      >
        <div className="w-full px-8" style={{ maxWidth: 400 }}>
          {/* Heading */}
          <h2
            className="font-sans font-bold"
            style={{ fontSize: "1.85rem", color: "#131b2e", marginBottom: "0.5rem" }}
          >
            Welcome back
          </h2>
          <p
            className="font-body"
            style={{ fontSize: "0.95rem", color: "#444656", marginBottom: "2.25rem" }}
          >
            Sign in to your account
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col">
            {/* Error message */}
            {error && (
              <div
                className="mb-4 rounded-md px-3 py-2 text-sm"
                style={{ background: "rgba(186,26,26,0.08)", color: "#ba1a1a" }}
              >
                {error}
              </div>
            )}

            {/* Email */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label
                htmlFor="email"
                className="block font-body font-medium"
                style={{ fontSize: "0.8rem", color: "#444656", marginBottom: "0.4rem" }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg font-body transition-shadow outline-none focus:shadow-[0_0_0_2px_rgba(48,82,255,0.25)]"
                style={{
                  padding: "0.75rem 1rem",
                  fontSize: "0.9rem",
                  background: "#f2f3ff",
                  color: "#131b2e",
                  border: "none",
                }}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label
                htmlFor="password"
                className="block font-body font-medium"
                style={{ fontSize: "0.8rem", color: "#444656", marginBottom: "0.4rem" }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg font-body transition-shadow outline-none focus:shadow-[0_0_0_2px_rgba(48,82,255,0.25)]"
                style={{
                  padding: "0.75rem 1rem",
                  fontSize: "0.9rem",
                  background: "#f2f3ff",
                  color: "#131b2e",
                  border: "none",
                }}
              />
            </div>

            {/* Remember me */}
            <div
              className="flex items-center justify-between"
              style={{ marginBottom: "1.75rem" }}
            >
              <label
                className="flex items-center gap-2 font-body cursor-pointer"
                style={{ fontSize: "0.85rem", color: "#444656" }}
              >
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="cursor-pointer"
                  style={{ width: 16, height: 16, accentColor: "#3052ff" }}
                />
                Remember me
              </label>
            </div>

            {/* Sign In button */}
            <button
              type="submit"
              disabled={loading}
              className="gradient-primary w-full font-body font-semibold text-white rounded-lg transition-opacity hover:opacity-90 active:opacity-100 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ padding: "0.8rem", fontSize: "0.95rem", border: "none" }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>

            {/* Forgot password */}
            <a
              href="#"
              className="block text-center font-body font-medium hover:underline"
              style={{ marginTop: "1.25rem", fontSize: "0.85rem", color: "#3052ff" }}
            >
              Forgot password?
            </a>
          </form>
        </div>
      </div>
    </div>
  );
}
