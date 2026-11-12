"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, Wallet, ArrowLeftRight, PiggyBank, MessageSquareText, Menu, X, ShieldCheck } from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/accounts", label: "My Accounts", icon: Wallet },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/budgets", label: "My Budgets", icon: PiggyBank },
  { href: "/chat", label: "Banking Chat", icon: MessageSquareText },
];

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link key={href} href={href} onClick={onNavigate} aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-brand text-white shadow-lg shadow-brand/30" : "text-blue-100/80 hover:bg-white/10 hover:text-white"}`}>
            <Icon size={18} aria-hidden /> {label}
          </Link>
        );
      })}
    </nav>
  );
}

const Brand = () => (
  <div className="flex items-center gap-2.5 px-3">
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white"><ShieldCheck size={20} aria-hidden /></span>
    <span className="text-lg font-bold tracking-tight text-white">PayWise</span>
  </div>
);

export default function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; }, [open]);
  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col gap-8 bg-navy-900 p-4 pt-6 lg:flex">
        <Brand /><Nav />
      </aside>
      <header className="sticky top-0 z-30 flex items-center justify-between bg-navy-900 px-4 py-3 lg:hidden">
        <Brand />
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg p-2 text-white hover:bg-white/10"><Menu size={22} /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-navy-950/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] animate-rise flex-col gap-8 bg-navy-900 p-4 pt-5">
            <div className="flex items-center justify-between"><Brand />
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-lg p-2 text-white hover:bg-white/10"><X size={20} /></button></div>
            <Nav onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">{children}</main>
    </div>
  );
}
