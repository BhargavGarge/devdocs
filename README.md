# DevDocs AI

A codebase-aware RAG (Retrieval-Augmented Generation) assistant. Point it at any
public GitHub repository and ask engineering questions in plain English —
_"Where is the payment logic?"_, _"How do I add a new API endpoint following
the existing pattern?"_ — and get back an answer grounded in the actual code,
with file-level citations and similarity scores.
DevDocs@08123
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
  _only_ from retrieved chunks, and every answer comes with the source files
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

| Layer            | Tool                                  | Why                                                     |
| ---------------- | ------------------------------------- | ------------------------------------------------------- |
| Backend          | Python + FastAPI                      | Async-friendly, fast to iterate, automatic OpenAPI docs |
| Vector database  | PostgreSQL + pgvector                 | One database for app data and vectors, no extra infra   |
| Embeddings       | sentence-transformers (MiniLM-L6)     | Runs locally, no API key, 384-dim, fast enough for dev  |
| LLM (generation) | Groq — llama-3.3-70b-versatile        | LPU inference, ~300ms responses, generous free tier     |
| Evaluation       | Custom LLM-as-judge (RAGAS-style)     | Faithfulness / relevancy / context-recall scoring       |
| Frontend         | Next.js 16 + Tailwind + Framer Motion | Familiar, fast to build a polished UI                   |

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
2. Ask a question — e.g. _"How do I create a blueprint in Flask?"_
3. Read the answer plus the cited files and similarity scores.

## Deployment

Backend on **Render**, frontend on **Vercel** (no Docker required for either —
Render builds the Python app natively via `render.yaml`).

### 1. Database — managed Postgres with pgvector

Use [Render Postgres](https://render.com/docs/postgresql) (pgvector is
supported out of the box) or [Neon](https://neon.tech)/[Supabase](https://supabase.com)
if you'd rather keep it separate from the app host. Once created, connect to
it and re-run the `CREATE EXTENSION vector` / `CREATE TABLE chunks` steps from
[Entry 4 of the journal](./JOURNAL.md#entry-4--vector-storage--semantic-search).
Keep the resulting connection string for the next step.

### 2. Backend — Render

1. Push this repo to GitHub (done ✅).
2. In Render: **New → Blueprint**, point it at the repo — it will pick up
   [`render.yaml`](./render.yaml) and configure the service automatically
   (root dir `backend`, `pip install -r requirements.txt`,
   `uvicorn app.main:app --host 0.0.0.0 --port $PORT`).
   - Alternatively, **New → Web Service** manually with those same settings
     if you'd rather not use the blueprint.
3. Set the environment variables Render prompts for (marked `sync: false`
   in `render.yaml`): `GITHUB_TOKEN`, `DATABASE_URL`, `GROQ_API_KEY`. Leave
   `ALLOWED_ORIGINS` for step 4.
4. Deploy. Note the resulting URL, e.g. `https://devdocs-ai-backend.onrender.com`.

### 3. Frontend — Vercel

1. Import the repo into Vercel, set **root directory** to `frontend/`.
2. Add env var `NEXT_PUBLIC_API_URL` = your Render backend URL from step 2.
3. Deploy. Note the resulting URL, e.g. `https://devdocs-ai.vercel.app`.

### 4. Close the loop — CORS

Back in Render, set `ALLOWED_ORIGINS` on the backend service to your Vercel
URL (comma-separate multiple origins, e.g. to keep `localhost:3000` working
too: `https://devdocs-ai.vercel.app,http://localhost:3000`) and redeploy.
`app/main.py` reads this env var directly — no code change needed.

> Render's free tier spins the service down when idle, so the first request
> after a period of inactivity (and the first request after any deploy, since
> the embedding model has to load) will be slow — this is expected, not a bug.

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
