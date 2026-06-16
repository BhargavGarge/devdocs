"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const steps = [
  {
    number: "01",
    title: "Index a Repository",
    description:
      "Paste any public GitHub URL. DevDocs AI crawls every source file using the GitHub Tree API, splits them into overlapping chunks, and stores 384-dimensional embeddings in pgvector.",
    tag: "GitHub API · asyncio",
  },
  {
    number: "02",
    title: "Ask in Plain English",
    description:
      "Type any question about the codebase. Your query is embedded with the same all-MiniLM-L6-v2 model so it lands in the same vector space as your code chunks.",
    tag: "sentence-transformers · pgvector",
  },
  {
    number: "03",
    title: "Get Precise Answers",
    description:
      "The top-5 most relevant chunks are retrieved by cosine similarity and passed to LLaMA 3.3 70B on Groq. The model answers only from your code — no hallucination.",
    tag: "Groq · LLaMA 3.3 70B",
  },
];

export default function HowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.fromTo(
        ".step-card",
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.12,
          duration: 0.7,
          ease: "power3.out",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 72%",
          },
        }
      );
      gsap.fromTo(
        ".how-header",
        { y: 20, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          ease: "power3.out",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 80%",
          },
        }
      );
    },
    { scope: containerRef }
  );

  return (
    <section id="how-it-works" className="relative" ref={containerRef}>
      {/* Section divider */}
      <div className="h-2 bg-black" />

      <div className="py-32 px-6 md:px-8 lg:px-12">
        <div className="max-w-6xl mx-auto">
          <div className="how-header mb-20">
            <span
              className="text-xs uppercase tracking-widest text-[var(--muted-foreground)]"
              style={{ fontFamily: "var(--font-jetbrains)" }}
            >
              How it works
            </span>
            <h2
              className="mt-4 text-[clamp(2.5rem,6vw,5.5rem)] font-bold tracking-tight leading-[0.9]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              From repo to answers
              <br />
              <em className="font-normal">in a few seconds.</em>
            </h2>
            <p
              className="mt-6 text-lg text-[var(--muted-foreground)] max-w-lg leading-relaxed"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Three stages connect a raw GitHub URL to a grounded,
              citation-backed response.
            </p>
          </div>

          {/* Bordered step grid */}
          <div className="grid md:grid-cols-3 border-l border-t border-black">
            {steps.map((step) => (
              <div
                key={step.number}
                className="step-card group relative p-8 border-r border-b border-black bg-white hover:bg-black hover:text-white transition-colors duration-100 cursor-default overflow-hidden"
              >
                {/* Oversized number watermark */}
                <div
                  className="absolute top-2 right-4 text-[7rem] font-black leading-none select-none opacity-[0.04] group-hover:opacity-[0.07] transition-opacity duration-100"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {step.number}
                </div>

                <p
                  className="text-xs uppercase tracking-widest text-[var(--muted-foreground)] group-hover:text-white/50 mb-6 transition-colors duration-100"
                  style={{ fontFamily: "var(--font-jetbrains)" }}
                >
                  Step {step.number}
                </p>

                <h3
                  className="text-xl font-bold mb-4 transition-colors duration-100"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {step.title}
                </h3>

                <p
                  className="text-sm text-[var(--muted-foreground)] group-hover:text-white/70 leading-relaxed mb-8 transition-colors duration-100"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {step.description}
                </p>

                <span
                  className="inline-block text-xs px-3 py-1.5 border border-black group-hover:border-white/30 text-[var(--muted-foreground)] group-hover:text-white/50 transition-colors duration-100"
                  style={{ fontFamily: "var(--font-jetbrains)" }}
                >
                  {step.tag}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
