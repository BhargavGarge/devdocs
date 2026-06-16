"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Link2, Send, Loader2, AlertCircle, RotateCcw } from "lucide-react";
import { indexRepo } from "@/lib/api";
import type { Source } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Phase = "idle" | "indexing" | "ready" | "querying";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  isStreaming?: boolean;
}

const EXAMPLE_REPOS = [
  "https://github.com/pallets/flask",
  "https://github.com/tiangolo/fastapi",
  "https://github.com/psf/requests",
];

export default function AppPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [repo, setRepo] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [indexStats, setIndexStats] = useState<{ files: number; chunks: number } | null>(null);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [streamingMsg, setStreamingMsg] = useState<{ content: string; sources: Source[] } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Word-by-word streaming refs
  const pendingWordsRef = useRef<string[]>([]);
  const partialRef = useRef("");
  const drainerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const serverDoneRef = useRef(false);
  const accumulatedRef = useRef("");
  const streamingSourcesRef = useRef<Source[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase]);

  useEffect(() => {
    return () => { if (drainerRef.current) clearInterval(drainerRef.current); };
  }, []);

  function enqueueTokens(content: string) {
    const text = partialRef.current + content;
    const matches = text.match(/\S+\s*|\s+/g) ?? [];
    if (text.length > 0 && !/\s$/.test(text)) {
      partialRef.current = matches.pop() ?? "";
    } else {
      partialRef.current = "";
    }
    pendingWordsRef.current.push(...matches);
  }

  function flushPartial() {
    if (partialRef.current) {
      pendingWordsRef.current.push(partialRef.current);
      partialRef.current = "";
    }
  }

  function stopDrainer() {
    if (drainerRef.current) { clearInterval(drainerRef.current); drainerRef.current = null; }
    pendingWordsRef.current = [];
    partialRef.current = "";
    serverDoneRef.current = false;
  }

  useEffect(() => {
    if (phase === "ready") {
      inputRef.current?.focus();
    }
  }, [phase]);

  async function handleIndex(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPhase("indexing");
    try {
      const result = await indexRepo(repoUrl);
      setRepo(result.repo);
      setIndexStats({ files: result.files_found, chunks: result.chunks_stored });
      setMessages([]);
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to index repository");
      setPhase("idle");
    }
  }

  async function handleQuery(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || phase !== "ready") return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: question.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");
    setPhase("querying");

    // Reset streaming state
    stopDrainer();
    accumulatedRef.current = "";
    streamingSourcesRef.current = [];
    setStreamingMsg(null);
    serverDoneRef.current = false;

    // Start word drainer — pops one word/token every 50 ms
    drainerRef.current = setInterval(() => {
      const word = pendingWordsRef.current.shift();
      if (word !== undefined) {
        accumulatedRef.current += word;
        const snap = accumulatedRef.current;
        setStreamingMsg((prev) =>
          prev
            ? { ...prev, content: snap }
            : { content: snap, sources: streamingSourcesRef.current }
        );
      } else if (serverDoneRef.current) {
        clearInterval(drainerRef.current!);
        drainerRef.current = null;
        const content = accumulatedRef.current;
        const sources = streamingSourcesRef.current;
        setStreamingMsg(null);
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: "assistant", content, sources },
        ]);
        setPhase("ready");
      }
    }, 50);

    try {
      const res = await fetch(`${API_BASE}/query/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userMsg.content, repo }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "sources") {
              streamingSourcesRef.current = event.content;
              setStreamingMsg((prev) => prev ? { ...prev, sources: event.content } : prev);
            } else if (event.type === "token") {
              enqueueTokens(event.content);
            } else if (event.type === "done") {
              flushPartial();
              serverDoneRef.current = true;
            } else if (event.type === "error") {
              stopDrainer();
              setStreamingMsg(null);
              setMessages((prev) => [
                ...prev,
                { id: `e-${Date.now()}`, role: "assistant", content: event.content },
              ]);
              setPhase("ready");
            }
          } catch { /* skip malformed SSE line */ }
        }
      }
    } catch (err) {
      stopDrainer();
      setStreamingMsg(null);
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: `Error: ${err instanceof Error ? err.message : "Query failed. Is the backend running?"}`,
        },
      ]);
      setPhase("ready");
    }
  }

  function reset() {
    stopDrainer();
    setStreamingMsg(null);
    setPhase("idle");
    setRepo("");
    setRepoUrl("");
    setMessages([]);
    setIndexStats(null);
    setError("");
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="h-16 shrink-0 flex items-center px-6 md:px-8 lg:px-12 border-b-2 border-black bg-white sticky top-0 z-10">
        <Link
          href="/"
          className="flex items-center gap-2 text-[var(--muted-foreground)] hover:text-black transition-colors mr-8 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-black"
          style={{ fontFamily: "var(--font-jetbrains)" }}
        >
          <ArrowLeft size={14} />
          <span className="text-xs uppercase tracking-widest">Back</span>
        </Link>

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

        {repo && (
          <div className="ml-auto flex items-center gap-4">
            <div
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 border border-black text-xs text-[var(--muted-foreground)]"
              style={{ fontFamily: "var(--font-jetbrains)" }}
            >
              <Link2 size={11} />
              <span className="font-mono">{repo}</span>
            </div>
            {indexStats && (
              <span
                className="text-xs text-[var(--muted-foreground)] hidden md:inline"
                style={{ fontFamily: "var(--font-jetbrains)" }}
              >
                {indexStats.chunks} chunks · {indexStats.files} files
              </span>
            )}
            <button
              onClick={reset}
              className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-black transition-colors uppercase tracking-widest"
              style={{ fontFamily: "var(--font-jetbrains)" }}
            >
              <RotateCcw size={11} />
              Change
            </button>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {/* ── INDEX FORM ── */}
          {(phase === "idle" || phase === "indexing") && (
            <motion.div
              key="index"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4 }}
              className="flex-1 flex items-center justify-center px-6 py-20"
            >
              <div className="w-full max-w-lg">
                {/* Decorative rule */}
                <div className="flex items-center gap-4 mb-8">
                  <div className="h-[5px] w-16 bg-black" />
                  <div className="w-4 h-4 border-2 border-black" />
                </div>

                {/* Heading */}
                <div className="mb-10">
                  <span
                    className="block text-xs uppercase tracking-widest text-[var(--muted-foreground)] mb-4"
                    style={{ fontFamily: "var(--font-jetbrains)" }}
                  >
                    Step 01 — Index
                  </span>
                  <h1
                    className="text-4xl font-bold leading-tight tracking-tighter mb-3"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Index a repository
                  </h1>
                  <p
                    className="text-[var(--muted-foreground)] leading-relaxed"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    Paste a public GitHub URL to crawl, embed, and index the entire codebase.
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleIndex} className="space-y-3">
                  <div className="relative">
                    <Link2
                      size={13}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                    />
                    <input
                      type="url"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      placeholder="https://github.com/owner/repo"
                      required
                      disabled={phase === "indexing"}
                      className="w-full pl-9 pr-4 py-3 border-2 border-black bg-white text-black placeholder:text-[#c0c0c0] focus:outline-none focus:outline-[3px] focus:outline-black disabled:opacity-50 text-sm"
                      style={{ fontFamily: "var(--font-jetbrains)" }}
                    />
                  </div>

                  {error && (
                    <div
                      className="flex items-start gap-2.5 p-3.5 border-2 border-black text-xs"
                      style={{ fontFamily: "var(--font-jetbrains)" }}
                    >
                      <AlertCircle size={13} className="shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={phase === "indexing" || !repoUrl.trim()}
                    className="w-full py-3.5 bg-black text-white hover:bg-white hover:text-black border-2 border-black disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium uppercase tracking-widest transition-colors duration-100 flex items-center justify-center gap-2"
                    style={{ fontFamily: "var(--font-jetbrains)" }}
                  >
                    {phase === "indexing" ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        Indexing repository…
                      </>
                    ) : (
                      "Index Repository →"
                    )}
                  </button>
                </form>

                {/* Examples */}
                <div className="mt-8">
                  <p
                    className="text-xs uppercase tracking-widest text-[var(--muted-foreground)] mb-3"
                    style={{ fontFamily: "var(--font-jetbrains)" }}
                  >
                    Try an example
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {EXAMPLE_REPOS.map((url) => (
                      <button
                        key={url}
                        onClick={() => setRepoUrl(url)}
                        disabled={phase === "indexing"}
                        className="text-xs px-3 py-1.5 border border-black text-[var(--muted-foreground)] hover:bg-black hover:text-white transition-colors duration-100 disabled:opacity-40"
                        style={{ fontFamily: "var(--font-jetbrains)" }}
                      >
                        {url.replace("https://github.com/", "")}
                      </button>
                    ))}
                  </div>
                </div>

                <p
                  className="text-xs text-[#c0c0c0] mt-6"
                  style={{ fontFamily: "var(--font-jetbrains)" }}
                >
                  Large repos (~1000 files) may take 20–40 seconds to index.
                </p>
              </div>
            </motion.div>
          )}

          {/* ── CHAT ── */}
          {(phase === "ready" || phase === "querying") && (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-6 overflow-hidden"
            >
              {/* Messages */}
              <div className="flex-1 overflow-y-auto py-10 space-y-8">
                {messages.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="py-20"
                  >
                    {/* Decorative rule */}
                    <div className="flex items-center gap-4 mb-8">
                      <div className="h-[5px] w-12 bg-black" />
                      <div className="w-3 h-3 border-2 border-black" />
                    </div>

                    <span
                      className="block text-xs uppercase tracking-widest text-[var(--muted-foreground)] mb-4"
                      style={{ fontFamily: "var(--font-jetbrains)" }}
                    >
                      Step 02 — Ask
                    </span>
                    <h2
                      className="text-3xl font-bold tracking-tighter mb-3"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      Ask anything about{" "}
                      <span className="italic">{repo}</span>
                    </h2>
                    <p
                      className="text-[var(--muted-foreground)] mb-8 max-w-sm"
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      Try: &ldquo;How does routing work?&rdquo; or &ldquo;Where is auth handled?&rdquo;
                    </p>

                    {/* Suggested questions */}
                    <div className="flex flex-wrap gap-2">
                      {[
                        "How does routing work?",
                        "Where is authentication handled?",
                        "How do I add a new endpoint?",
                        "What does the main app file do?",
                      ].map((q) => (
                        <button
                          key={q}
                          onClick={() => setQuestion(q)}
                          className="text-xs px-3 py-1.5 border border-black text-[var(--muted-foreground)] hover:bg-black hover:text-white transition-colors duration-100"
                          style={{ fontFamily: "var(--font-jetbrains)" }}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}

                {/* Word-by-word streaming message */}
                {streamingMsg !== null && (
                  <MessageBubble
                    message={{ id: "streaming", role: "assistant", ...streamingMsg, isStreaming: true }}
                  />
                )}

                {/* Typing indicator — only before first word arrives */}
                {phase === "querying" && streamingMsg === null && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-4"
                  >
                    <div className="w-7 h-7 bg-black flex items-center justify-center shrink-0 mt-0.5">
                      <span
                        className="text-white text-xs font-bold"
                        style={{ fontFamily: "var(--font-jetbrains)" }}
                      >
                        D
                      </span>
                    </div>
                    <div className="flex gap-1.5 items-center h-9 px-4 border-2 border-black border-tl-0">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-1.5 h-1.5 bg-black"
                          animate={{ opacity: [0.2, 1, 0.2] }}
                          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input bar */}
              <div className="shrink-0 py-5 border-t-2 border-black">
                <form onSubmit={handleQuery} className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder={`Ask a question about ${repo}…`}
                    disabled={phase === "querying"}
                    className="w-full pl-4 pr-14 py-3.5 border-2 border-black bg-white text-black placeholder:text-[#c0c0c0] focus:outline-none focus:outline-[3px] focus:outline-black disabled:opacity-50 text-sm"
                    style={{ fontFamily: "var(--font-jetbrains)" }}
                  />
                  <button
                    type="submit"
                    disabled={phase === "querying" || !question.trim()}
                    className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-center bg-black text-white hover:bg-[#333] disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-l-2 border-black"
                  >
                    <Send size={13} />
                  </button>
                </form>
                <p
                  className="text-xs text-[#c0c0c0] mt-2.5"
                  style={{ fontFamily: "var(--font-jetbrains)" }}
                >
                  Answers are grounded in retrieved code chunks — not training data.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex gap-4 ${isUser ? "flex-row-reverse" : ""}`}
    >
      {!isUser && (
        <div className="w-7 h-7 bg-black flex items-center justify-center shrink-0 mt-0.5">
          <span
            className="text-white text-xs font-bold"
            style={{ fontFamily: "var(--font-jetbrains)" }}
          >
            D
          </span>
        </div>
      )}

      <div className={`flex flex-col gap-2 ${isUser ? "items-end" : "items-start"} max-w-[88%]`}>
        <div
          className={`px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap border-2 border-black ${
            isUser
              ? "bg-black text-white"
              : "bg-white text-black"
          }`}
          style={{ fontFamily: isUser ? "var(--font-jetbrains)" : "var(--font-body)" }}
        >
          {message.content}
          {message.isStreaming && (
            <span className="inline-block w-[2px] h-[1em] bg-current ml-[1px] animate-pulse align-text-bottom" />
          )}
        </div>

        {/* Source citations */}
        {message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.sources.slice(0, 5).map((src, i) => (
              <span
                key={i}
                title={`Similarity: ${(src.similarity * 100).toFixed(0)}%`}
                className="text-[11px] px-2.5 py-1 border border-black text-[var(--muted-foreground)] cursor-default hover:bg-black hover:text-white transition-colors duration-100"
                style={{ fontFamily: "var(--font-jetbrains)" }}
              >
                {src.file_path.split("/").slice(-2).join("/")}
                <span className="ml-1.5 opacity-50">
                  {(src.similarity * 100).toFixed(0)}%
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
