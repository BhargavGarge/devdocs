import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t-4 border-black bg-white py-10 px-6 md:px-8 lg:px-12">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-black flex items-center justify-center shrink-0">
            <span
              className="text-white text-xs font-bold"
              style={{ fontFamily: "var(--font-jetbrains)" }}
            >
              D
            </span>
          </div>
          <span
            className="font-semibold text-black text-sm tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            DevDocs AI
          </span>
        </div>

        <p
          className="text-xs text-[var(--muted-foreground)] text-center"
          style={{ fontFamily: "var(--font-jetbrains)" }}
        >
          Built by{" "}
          <span className="text-black font-medium">Bhargav</span>
          {" · "}RAG · FastAPI · pgvector · sentence-transformers · Groq · Next.js
        </p>

        <Link
          href="/app"
          className="text-sm text-black hover:underline underline-offset-4 transition-colors focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-black focus-visible:outline-offset-[3px]"
          style={{ fontFamily: "var(--font-jetbrains)" }}
        >
          Try it free →
        </Link>
      </div>
    </footer>
  );
}
