"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SearchInput } from "@/components/SearchInput";

const NAV_LINKS = [
  { href: "/", label: "Hjem" },
  { href: "/#hot-drops", label: "Hot Drops" },
  { href: "/browse", label: "Alle disker" },
  { href: "/bag/build", label: "Bygg min bag" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!menuOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <>
      <nav className="sticky top-0 z-50 flex w-full items-center justify-between border-b-2 border-[#101C14] bg-[#FFFDF6] px-5 py-3.5 md:px-10">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="DiscDrop – til forsiden">
          <Image src="/discdrop-logo-clean.svg" alt="" width={34} height={34} className="h-8 w-8 md:h-9 md:w-9" />
          <span className="text-lg font-extrabold tracking-tight text-[#101C14] md:text-xl">discdrop</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href.split("#")[0]) && link.href !== "/#hot-drops";
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3.5 py-2 text-sm font-semibold transition-colors duration-150 ${
                  active ? "bg-[#101C14] text-[#FFFDF6]" : "text-[#101C14] hover:bg-[#F1EFE6]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Åpne meny"
          className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-[#101C14] bg-white shadow-[2px_2px_0_#101C14] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_#101C14] md:hidden"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#101C14" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <path d="M4 7h16M4 12h10M4 17h16" />
          </svg>
        </button>
      </nav>

      {menuOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-[#101C14] text-[#FFFDF6] md:hidden">
          <div className="flex items-center justify-between px-5 py-3.5">
            <Link href="/" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5" aria-label="DiscDrop – til forsiden">
              <Image src="/discdrop-logo-clean.svg" alt="" width={32} height={32} className="h-8 w-8" />
              <span className="text-lg font-extrabold tracking-tight text-[#FFFDF6]">discdrop</span>
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Lukk meny"
              className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-[#B8E04A] bg-[#101C14]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B8E04A" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className="flex flex-1 flex-col overflow-y-auto px-6 py-6">
            <div className="mb-6">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Søk blant 683 disker …"
                inputId="mobile-menu-search"
              />
            </div>

            {NAV_LINKS.map((link, i) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="flex items-baseline gap-3.5 border-b border-white/10 py-4 text-3xl font-extrabold tracking-tight text-[#FFFDF6] transition-colors hover:text-[#B8E04A]"
              >
                <span className="text-xs font-semibold text-[#B8E04A]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {link.label}
              </Link>
            ))}

            <div className="mt-7">
              <span className="inline-block -rotate-3 rounded-lg bg-[#B8E04A] px-2.5 py-1.5 text-xs font-extrabold text-[#101C14] shadow-[2px_2px_0_#101C14]">
                Oppdatert i dag ✓
              </span>
            </div>
            <p className="mt-6 text-xs text-white/40">
              <Link href="/kontakt" onClick={() => setMenuOpen(false)} className="hover:text-white/70">Kontakt</Link>
              {" · "}
              <Link href="/personvern" onClick={() => setMenuOpen(false)} className="hover:text-white/70">Personvern</Link>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
