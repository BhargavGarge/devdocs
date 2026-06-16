"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const stack = [
  { name: "FastAPI", role: "Backend & API" },
  { name: "pgvector", role: "Vector Storage" },
  { name: "LlamaIndex", role: "RAG Framework" },
  { name: "Groq", role: "LLM Inference" },
  { name: "sentence-transformers", role: "Embeddings" },
  { name: "Next.js", role: "Frontend" },
];

export default function TechStack() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.fromTo(
        ".stack-item",
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.08,
          duration: 0.65,
          ease: "power2.out",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 75%",
          },
        }
      );
      gsap.fromTo(
        ".stack-header",
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
    <section id="stack" className="relative" ref={containerRef}>
      <div className="h-2 bg-black" />

      {/* Inverted section */}
      <div className="relative bg-black overflow-hidden py-32 px-6 md:px-8 lg:px-12">
        {/* Vertical line texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent, transparent 1px, #fff 1px, #fff 2px)",
            backgroundSize: "4px 100%",
            opacity: 0.03,
          }}
        />

        <div className="relative max-w-6xl mx-auto">
          <div className="stack-header mb-16">
            <span
              className="text-xs uppercase tracking-widest text-white/40"
              style={{ fontFamily: "var(--font-jetbrains)" }}
            >
              Tech Stack
            </span>
            <h2
              className="mt-4 text-[clamp(2.5rem,6vw,5.5rem)] font-bold tracking-tight leading-[0.9] text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Assembled from
              <br />
              <em className="font-normal">best-in-class tools.</em>
            </h2>
          </div>

          {/* Bordered grid on dark background */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 border-l border-t border-white/20">
            {stack.map((item) => (
              <div
                key={item.name}
                className="stack-item group flex flex-col items-center justify-center gap-3 py-10 px-4 border-r border-b border-white/20 hover:bg-white transition-colors duration-100 cursor-default text-center"
              >
                <p
                  className="text-sm font-semibold text-white group-hover:text-black leading-tight transition-colors duration-100"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {item.name}
                </p>
                <p
                  className="text-xs text-white/40 group-hover:text-black/50 transition-colors duration-100"
                  style={{ fontFamily: "var(--font-jetbrains)" }}
                >
                  {item.role}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
