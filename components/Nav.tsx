"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/#cashflow", label: "Dashboard" },
  { href: "/upload", label: "Upload Data" },
  { href: "/#inventory", label: "Inventory" },
  { href: "/#purchasing", label: "Purchasing" },
  { href: "/#receivables", label: "Receivables" },
  { href: "/#payables", label: "Payables" },
  { href: "/#financing", label: "Financing" },
];

const AUTH_PATHS = ["/login", "/signup"];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const isAuthPage = AUTH_PATHS.includes(pathname);

  useEffect(() => {
    if (isAuthPage) return;
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setCompanyId(data.user?.companyId ?? null));
  }, [isAuthPage, pathname]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-sm font-bold text-white">
            W
          </span>
          <span className="text-sm font-semibold tracking-tight text-slate-900">
            Wholesale Cash Flow Intelligence
          </span>
        </Link>
        {!isAuthPage && (
          <div className="flex items-center gap-4">
            <nav className="flex gap-1 text-sm font-medium">
              {LINKS.map((link) => {
                const active = pathname === link.href.split("#")[0];
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-md px-3 py-1.5 transition-colors ${
                      active
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
            {companyId && (
              <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
                <span className="text-xs text-slate-400">{companyId}</span>
                <button
                  onClick={handleLogout}
                  className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
