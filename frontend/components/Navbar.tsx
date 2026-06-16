"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 bg-[var(--background)] transition-all duration-100 ${
        scrolled ? "border-b-4 border-black" : "border-b border-[var(--border-light)]"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 md:px-8 lg:px-12 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-black focus-visible:outline-offset-[3px]"
        >
          <div className="w-7 h-7 bg-black flex items-center justify-center shrink-0">
            <span
              className="text-white text-xs font-bold"
              style={{ fontFamily: "var(--font-jetbrains)" }}
            >
              D
            </span>
          </div>
          <span
            className="font-semibold text-black tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            DevDocs AI
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-10">
          <NavLink href="#how-it-works">How it works</NavLink>
          <NavLink href="#features">Features</NavLink>
          <NavLink href="#stack">Stack</NavLink>
        </div>

        <Link
          href="/app"
          className="px-5 py-2.5 bg-black text-white hover:bg-white hover:text-black border-2 border-black text-xs font-medium uppercase tracking-widest transition-colors duration-100 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-black focus-visible:outline-offset-[3px]"
          style={{ fontFamily: "var(--font-jetbrains)" }}
        >
          Try it free →
        </Link>
      </div>
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="text-xs text-[var(--muted-foreground)] hover:text-black uppercase tracking-widest transition-colors duration-100 focus-visible:outline-none focus-visible:border-b-2 focus-visible:border-black pb-0.5"
      style={{ fontFamily: "var(--font-jetbrains)" }}
    >
      {children}
    </a>
  );
}
