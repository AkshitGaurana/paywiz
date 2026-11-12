"use client";

import { useState } from "react";

export default function LoginPage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    setLoading(false);
    if (res.ok) {
      window.location.href = "/";
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Login failed");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm p-8">
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-300 via-pink-300 to-amber-200 text-xl font-bold text-white shadow-md">₹</div>
        <p className="bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-sm font-bold text-transparent">PayWise</p>
        <h1 className="mt-1 text-lg font-semibold">Smart Banking Assistant</h1>
        <p className="mt-1 text-sm text-slate-500">Enter the team passcode to continue. This keeps your app and your Gemini quota safe.</p>
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          className="field mt-4 w-full"
          placeholder="Passcode"
          autoFocus
        />
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={loading || !passcode}
          className="btn-primary mt-4 w-full"
        >
          {loading ? "Checking..." : "Enter"}
        </button>
      </form>
    </main>
  );
}
