"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.4, 0.55, 1] } },
};

export default function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden px-6 md:px-8 lg:px-12 pt-24 pb-20">
      {/* Horizontal line texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 1px, #000 1px, #000 2px)",
          backgroundSize: "100% 4px",
          opacity: 0.015,
        }}
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 max-w-6xl mx-auto w-full"
      >
        {/* Label */}
        <motion.span
          variants={item}
          className="block text-xs uppercase tracking-widest text-[var(--muted-foreground)] mb-8"
          style={{ fontFamily: "var(--font-jetbrains)" }}
        >
          RAG-Powered · FastAPI · pgvector · LLaMA&nbsp;3.3
        </motion.span>

        {/* Decorative rule */}
        <motion.div variants={item} className="flex items-center gap-4 mb-10">
          <div className="h-[6px] w-20 bg-black" />
          <div className="w-5 h-5 border-2 border-black" />
        </motion.div>

        {/* Two-column layout: headline left, terminal right */}
        <div className="grid lg:grid-cols-[1fr,minmax(0,520px)] gap-16 xl:gap-24 items-start">
          {/* Left: headline + subtext + CTAs */}
          <div>
            <motion.h1
              variants={item}
              className="leading-[0.88] tracking-tighter mb-10"
              style={{ fontFamily: "var(--font-display)" }}
            >
              <span className="block text-[clamp(3.5rem,9vw,8rem)] font-bold">
                Ask your
              </span>
              <span className="block text-[clamp(3.5rem,9vw,8rem)] font-bold italic">
                codebase
              </span>
              <span className="block text-[clamp(3.5rem,9vw,8rem)] font-black">
                anything.
              </span>
            </motion.h1>

            <motion.p
              variants={item}
              className="text-lg md:text-xl text-[var(--muted-foreground)] leading-relaxed max-w-md mb-10"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Point DevDocs AI at any GitHub repository and get instant, accurate
              answers with real file citations — powered by semantic search and
              LLaMA&nbsp;3.3.
            </motion.p>

            <motion.div variants={item} className="flex flex-wrap gap-4">
              <Link
                href="/app"
                className="px-8 py-4 bg-black text-white hover:bg-white hover:text-black border-2 border-black text-xs font-medium uppercase tracking-widest transition-colors duration-100 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-black focus-visible:outline-offset-[3px]"
                style={{ fontFamily: "var(--font-jetbrains)" }}
              >
                Index your first repo →
              </Link>
              <a
                href="#how-it-works"
                className="px-8 py-4 bg-white text-black hover:bg-black hover:text-white border-2 border-black text-xs font-medium uppercase tracking-widest transition-colors duration-100 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-black focus-visible:outline-offset-[3px]"
                style={{ fontFamily: "var(--font-jetbrains)" }}
              >
                See how it works
              </a>
            </motion.div>
          </div>

          {/* Right: terminal mockup */}
          <motion.div variants={item} className="lg:pt-4">
            <TerminalMockup />
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

function TerminalMockup() {
  return (
    <div
      className="border-2 border-black bg-white text-left"
      style={{ fontFamily: "var(--font-jetbrains)" }}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-3 px-4 py-3 border-b-2 border-black bg-black">
        <span className="text-xs tracking-widest uppercase text-white/40">
          devdocs-ai — pallets/flask
        </span>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4 text-sm">
        <div className="text-[var(--muted-foreground)]">
          <span className="text-black font-medium">✓</span> Indexed{" "}
          <span className="font-medium text-black">pallets/flask</span> — 111 files · 530 chunks
        </div>

        <div className="flex gap-3">
          <span className="shrink-0 mt-0.5 font-bold">❯</span>
          <span>How does Flask handle URL routing?</span>
        </div>

        <div className="pl-4 border-l-2 border-black space-y-3">
          <p className="text-[var(--muted-foreground)] leading-relaxed">
            Flask uses a{" "}
            <span className="font-medium text-black">URL routing map</span> to
            associate view functions with URL patterns. Routes are registered via
            the{" "}
            <span className="font-bold text-black">@app.route()</span> decorator,
            which calls{" "}
            <span className="underline underline-offset-2">add_url_rule()</span>{" "}
            internally on the application&apos;s{" "}
            <span className="italic">url_map</span> object.
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            {[
              "src/flask/app.py",
              "src/flask/sansio/app.py",
              "src/flask/blueprints.py",
            ].map((f) => (
              <span
                key={f}
                className="text-xs px-2.5 py-1 border border-black text-[var(--muted-foreground)]"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
