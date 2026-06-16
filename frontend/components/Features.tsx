"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Search, FileCode2, Layers3, GitBranch, Zap, Cpu } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const features = [
  {
    icon: Search,
    title: "Semantic Search",
    description:
      'Finds relevant code by meaning, not keywords. "Where is the login logic?" correctly returns authenticate_user() — zero keyword overlap.',
  },
  {
    icon: FileCode2,
    title: "Source Citations",
    description:
      "Every answer includes the exact file paths that were retrieved, ranked by cosine similarity score so you can verify the source.",
  },
  {
    icon: Layers3,
    title: "RAG Architecture",
    description:
      "Only the top-5 most relevant chunks go to the LLM. No full-file bloat, no hallucination — the model is grounded in retrieved code.",
  },
  {
    icon: GitBranch,
    title: "Any Public Repository",
    description:
      "Works with any public GitHub repo. The GitHub Tree API returns the full file tree in a single request — 200 files indexed in ~5 seconds.",
  },
  {
    icon: Zap,
    title: "~300ms Responses",
    description:
      "Groq's LPU hardware runs LLaMA 3.3 70B with sub-second inference — no waiting spinner, just answers.",
  },
  {
    icon: Cpu,
    title: "Local Embeddings",
    description:
      "all-MiniLM-L6-v2 runs entirely on your machine after the first download. No API key, no per-token cost, works fully offline.",
  },
];

export default function Features() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.fromTo(
        ".feature-card",
        { y: 28, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.06,
          duration: 0.65,
          ease: "power2.out",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 72%",
          },
        }
      );
      gsap.fromTo(
        ".features-header",
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
    <section id="features" className="relative" ref={containerRef}>
      <div className="h-2 bg-black" />

      <div className="py-32 px-6 md:px-8 lg:px-12">
        <div className="max-w-6xl mx-auto">
          <div className="features-header mb-20">
            <span
              className="text-xs uppercase tracking-widest text-[var(--muted-foreground)]"
              style={{ fontFamily: "var(--font-jetbrains)" }}
            >
              Features
            </span>
            <h2
              className="mt-4 text-[clamp(2.5rem,6vw,5.5rem)] font-bold tracking-tight leading-[0.9]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Built for real
              <br />
              <em className="font-normal">developer questions.</em>
            </h2>
            <p
              className="mt-6 text-lg text-[var(--muted-foreground)] max-w-lg leading-relaxed"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Every design decision in the pipeline was made to maximize answer
              accuracy and eliminate noise.
            </p>
          </div>

          {/* Bordered feature grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 border-l border-t border-black">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="feature-card group p-8 border-r border-b border-black bg-white hover:bg-black hover:text-white transition-colors duration-100 cursor-default"
                >
                  <div className="w-10 h-10 border border-black group-hover:border-white flex items-center justify-center mb-6 transition-colors duration-100">
                    <Icon
                      size={18}
                      strokeWidth={1.5}
                      className="text-black group-hover:text-white transition-colors duration-100"
                    />
                  </div>
                  <h3
                    className="text-base font-bold mb-3 transition-colors duration-100"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {feature.title}
                  </h3>
                  <p
                    className="text-sm text-[var(--muted-foreground)] group-hover:text-white/70 leading-relaxed transition-colors duration-100"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
