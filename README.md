# DevDocs AI

A codebase-aware RAG (Retrieval-Augmented Generation) assistant. Point it at any
public GitHub repository and ask engineering questions in plain English —
*"Where is the payment logic?"*, *"How do I add a new API endpoint following
the existing pattern?"* — and get back an answer grounded in the actual code,
with file-level citations and similarity scores.

Built from scratch (no LlamaIndex/LangChain RAG abstractions) to understand
every layer of a retrieval pipeline: chunking, embeddings, vector search, and
grounded generation.

> 📓 Full build log with debugging notes and design trade-offs: [`JOURNAL.md`](./JOURNAL.md)
> 🖼️ Architecture diagram: [`devdocs_ai_architecture.svg`](./devdocs_ai_architecture.svg)

---

## How it works

```
GitHub repo URL
      │
      ▼
┌─────────────────┐   GitHub Tree API, async fetch (semaphore-limited)
│ github_fetcher   │   → list[{path, content}]
└────────┬─────────┘
         ▼
┌─────────────────┐   Line-based splitter, 1500 chars/chunk, 200 char overlap
│ chunker          │   → list[chunk]
└────────┬─────────┘
         ▼
┌─────────────────┐   sentence-transformers/all-MiniLM-L6-v2 (384-dim, local)
│ embedder         │   → list[chunk + embedding]
└────────┬─────────┘
         ▼
┌─────────────────┐   Postgres + pgvector, ivfflat cosine index
│ store            │   save_chunks() / search_chunks()
└────────┬─────────┘
         ▼
┌─────────────────┐   embed question → cosine search top-k → grounded prompt
│ query/pipeline   │   → Groq (llama-3.3-70b-versatile) → answer + citations
└────────┬─────────┘
         ▼
   FastAPI (/index, /query, /query/stream)  ◄──►  Next.js frontend
```

## Features

- **Any public GitHub repo** — paste a URL, it fetches, chunks, embeds, and
  indexes the whole thing in seconds (async fetch with bounded concurrency).
- **Grounded answers, not hallucinations** — the LLM is instructed to answer
  *only* from retrieved chunks, and every answer comes with the source files
  and cosine-similarity scores that produced it.
- **Streaming responses** — `/query/stream` streams tokens via SSE so answers
  appear incrementally instead of after a multi-second wait.
- **Custom RAG evaluation harness** — `app/eval/ragas_eval.py` scores
  faithfulness, answer relevancy, and context recall using an LLM-as-judge,
  following the metric definitions popularized by the [RAGAS](https://github.com/explodinggradients/ragas)
  framework (see [note on naming](#evaluation) below).
- **Local, free embeddings** — no API key or per-request cost for the
  embedding step; only the generation step calls an LLM (Groq, free tier).

## Tech stack

| Layer            | Tool                              | Why                                                        |
| ----------------- | ---------------------------------- | ----------------------------------------------------------- |
| Backend           | Python + FastAPI                   | Async-friendly, fast to iterate, automatic OpenAPI docs    |
| Vector database   | PostgreSQL + pgvector              | One database for app data and vectors, no extra infra     |
| Embeddings        | sentence-transformers (MiniLM-L6)  | Runs locally, no API key, 384-dim, fast enough for dev     |
| LLM (generation)  | Groq — llama-3.3-70b-versatile     | LPU inference, ~300ms responses, generous free tier        |
| Evaluation        | Custom LLM-as-judge (RAGAS-style)  | Faithfulness / relevancy / context-recall scoring          |
| Frontend          | Next.js 16 + Tailwind + Framer Motion | Familiar, fast to build a polished UI                   |

## Project structure

```
devDocs/
├── backend/
│   ├── app/
│   │   ├── ingestion/        # fetch → chunk → embed → store
│   │   ├── query/            # retrieval + grounded generation
│   │   ├── eval/             # RAG evaluation harness
│   │   └── main.py           # FastAPI app (/index, /query, /query/stream)
│   └── requirements.txt
└── frontend/
    ├── app/                  # Next.js App Router (landing page + /app demo UI)
    ├── components/           # Hero, Features, HowItWorks, TechStack, etc.
    └── lib/api.ts             # typed client for the FastAPI backend
```

## Running it locally

### Prerequisites

- Python 3.10+, Node 18+
- PostgreSQL with the [pgvector extension](https://github.com/pgvector/pgvector)
  installed (Windows users: see the [pgvector Windows build note](./JOURNAL.md#entry-4--vector-storage--semantic-search)
  in the journal for a working pre-compiled release)
- A free [Groq API key](https://console.groq.com) and a [GitHub personal access token](https://github.com/settings/tokens)
  (raises the GitHub API rate limit; unauthenticated requests work but are limited)

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\python.exe -m pip install -r requirements.txt   # Windows
# source venv/bin/activate && pip install -r requirements.txt  # macOS/Linux

# create backend/.env with:
#   GITHUB_TOKEN=...
#   DATABASE_URL=postgresql://user:password@localhost:5432/devdocs
#   GROQ_API_KEY=...

venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

API docs (Swagger UI) are then available at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install

# create frontend/.env.local with:
#   NEXT_PUBLIC_API_URL=http://localhost:8000

npm run dev
```

Open `http://localhost:3000`.

### Try it

1. Paste a GitHub URL (e.g. `https://github.com/pallets/flask`) and index it.
2. Ask a question — e.g. *"How do I create a blueprint in Flask?"*
3. Read the answer plus the cited files and similarity scores.

## Deployment

Not deployed yet — these are the intended paths (require your own accounts/credentials):

- **Frontend** → [Vercel](https://vercel.com): import the repo, set the root
  directory to `frontend/`, and set `NEXT_PUBLIC_API_URL` to the deployed
  backend URL.
- **Backend** → any host that runs a Dockerfile (Render, Railway, Fly.io):
  point it at `backend/Dockerfile`, set `GITHUB_TOKEN`, `DATABASE_URL`,
  `GROQ_API_KEY` as environment variables, and update the CORS
  `allow_origins` in `app/main.py` to the deployed frontend URL.
- **Database** → a managed Postgres with the pgvector extension enabled
  (e.g. Neon, Supabase, or Render Postgres all support it) — point
  `DATABASE_URL` at it and re-run the `CREATE EXTENSION vector` /
  `CREATE TABLE chunks` steps from [Entry 4 of the journal](./JOURNAL.md#entry-4--vector-storage--semantic-search).

## Evaluation

`backend/app/eval/ragas_eval.py` runs a fixed set of test questions against
an indexed repo and scores each answer on three axes, each via an LLM-as-judge
call to Groq:

- **Faithfulness** — what fraction of claims in the answer are supported by
  the retrieved context (catches hallucination)
- **Answer relevancy** — does the answer actually address the question
- **Context recall** — does the retrieved context contain what's needed to
  produce the expected answer (catches retrieval failures)

> **Naming note:** the `ragas` package is listed as a dependency and the
> metric definitions follow the RAGAS paper, but the scorer itself is a
> hand-rolled set of Groq prompts rather than a call into `ragas.metrics`.
> If you want the official library's implementation, swap the scoring
> functions in `ragas_eval.py` for `ragas.evaluate()`.

Run it with:

```bash
cd backend
venv\Scripts\python.exe -m app.eval.ragas_eval
```

## Known limitations / next steps

- Retrieval is pure vector similarity — low-score queries (observed ~0.3
  similarity on some questions during testing) would likely benefit from
  hybrid search (BM25 + vector), per the note in [`JOURNAL.md`](./JOURNAL.md).
- Chunking is line/character-based, not syntax-aware (tree-sitter was tried
  first; dropped due to dependency conflicts — see journal entry 2).
- No automated tests yet; evaluation is currently a manual script, not wired
  into CI.
- Single-tenant: re-indexing a repo overwrites its previous chunks
  (`clear_repo` before `save_chunks`), there's no per-user isolation.

## Learning log

This project was built and documented step by step — what was built, why,
and what broke along the way (including a real debugging session tracking
down a silent `psycopg2` parameter-quoting bug). See [`JOURNAL.md`](./JOURNAL.md).
