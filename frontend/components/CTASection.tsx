"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function CTASection() {
  return (
    <section className="relative">
      {/* Muted background with grid texture */}
      <div
        className="relative overflow-hidden py-32 px-6 md:px-8 lg:px-12"
        style={{ background: "var(--muted)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(#00000008 1px, transparent 1px), linear-gradient(90deg, #00000008 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.25, 0.4, 0.55, 1] }}
            className="border-2 border-black bg-white p-12 md:p-20 text-center"
          >
            <span
              className="text-xs uppercase tracking-widest text-[var(--muted-foreground)] block mb-8"
              style={{ fontFamily: "var(--font-jetbrains)" }}
            >
              Get started free
            </span>

            <h2
              className="text-[clamp(2.5rem,7vw,7rem)] font-bold tracking-tight leading-[0.88] mb-10"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Ready to understand
              <br />
              <em className="font-normal">any codebase?</em>
            </h2>

            <p
              className="text-lg text-[var(--muted-foreground)] mb-12 max-w-sm mx-auto leading-relaxed"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Index your first repository in seconds. No account, no credit card,
              no setup.
            </p>

            <Link
              href="/app"
              className="inline-flex items-center gap-3 px-10 py-5 bg-black text-white hover:bg-white hover:text-black border-2 border-black text-xs font-medium uppercase tracking-widest transition-colors duration-100 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-black focus-visible:outline-offset-[3px]"
              style={{ fontFamily: "var(--font-jetbrains)" }}
            >
              Index your first repo →
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
