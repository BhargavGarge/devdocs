# DevDocs AI — Learning Journal

_A codebase-aware RAG assistant built from scratch._

Written by **Bhargav** as a learning log documenting what was built, what was learned, and the challenges encountered along the way.

---

# What This Project Is

**DevDocs AI** allows developers to point to any GitHub repository and ask engineering questions in natural language, such as:

- _Where is the payment logic handled?_
- _What does this function do?_
- _How do I add a new API endpoint following the existing pattern?_

The application uses **Retrieval-Augmented Generation (RAG)**.

Instead of sending an entire codebase to an LLM (which becomes impractical for large repositories), the repository is first indexed into a vector database. At query time, only the most relevant code snippets and documentation are retrieved and provided to the model, enabling accurate and context-aware responses.

---

# Tech Stack

> Note: this table reflects the **initial plan**. A few choices changed during
> the build (see Entry 2 for why chunking moved off tree-sitter, and Entry 5
> for why the LLM moved from Gemini to Groq). The root [`README.md`](./README.md)
> reflects what was actually shipped.

| Layer           | Tool                  | Why (as planned)                                                |
| --------------- | --------------------- | --------------------------------------------------------------- |
| Backend         | Python + FastAPI      | LlamaIndex is Python-native and integrates well with FastAPI    |
| RAG Framework   | LlamaIndex            | Handles chunking, retrieval, and orchestration *(not used in the final build — see Entry 2; chunking/retrieval ended up hand-rolled)* |
| Vector Database | pgvector (PostgreSQL) | Existing familiarity with Postgres; fewer external dependencies |
| Embeddings      | sentence-transformers | Runs locally and requires no API key                            |
| LLM             | Gemini 2.0 Flash      | Generous free-tier limits *(switched to Groq/llama-3.3-70b — see Entry 5)* |
| Evaluation      | Ragas                 | Industry-standard RAG evaluation framework *(metric definitions follow RAGAS; the actual scorer is a hand-rolled LLM-as-judge, not a call into the `ragas` package — see `app/eval/ragas_eval.py`)* |
| Frontend        | Next.js               | Familiar and productive development experience                  |

---

# Entry 1 — GitHub Ingestion Pipeline

**Date:** June 2026
**Status:** ✅ Complete

## What We Built

Implemented:

```text
backend/app/ingestion/github_fetcher.py
```

This module serves as the first stage of the ingestion pipeline.

Its responsibilities are:

1. Accept a GitHub repository URL.
2. Discover all relevant files in the repository.
3. Download file contents.
4. Return a structured list of:

```python
{
    "path": "...",
    "content": "..."
}
```

objects for downstream processing.

---

## What I Learned

### 1. Using the GitHub Tree API

Endpoint:

```http
GET /repos/{owner}/{repo}/git/trees/HEAD?recursive=1
```

A single API request returns the complete file tree for a repository.

Without `recursive=1`, traversing the repository would require additional API calls for every directory, making the process significantly slower.

---

### 2. Why GitHub Uses Base64

GitHub returns file contents encoded as Base64.

This encoding allows binary-safe transmission of file data through JSON responses.

To convert the content back into readable text:

```python
base64.b64decode(data["content"]).decode(
    "utf-8",
    errors="ignore"
)
```

The `errors="ignore"` argument prevents decoding failures caused by unsupported or malformed characters.

---

### 3. Why Async Matters

A repository with 200 files requires approximately 200 content-fetch requests.

A synchronous implementation can take around:

```text
~60 seconds
```

Using:

```python
asyncio.gather(...)
```

combined with a semaphore limiting concurrency to 10 requests:

```python
asyncio.Semaphore(10)
```

reduces execution time to approximately:

```text
~5 seconds
```

The semaphore acts as a throttle, ensuring no more than 10 requests are executed simultaneously and preventing excessive load on the GitHub API.

---

### 4. Filtering File Extensions

Not every file in a repository is useful for retrieval.

Included:

```text
.py
.ts
.js
.jsx
.tsx
.md
```

Excluded:

```text
node_modules/
dist/
build/
```

Generated files and dependency folders add noise to embeddings, consume storage, and reduce retrieval quality.

Indexing only source code and documentation improves both relevance and efficiency.

---

### 5. The Windows Python Environment Problem

On Windows, multiple Python installations can exist simultaneously.

Running:

```bash
pip install package-name
```

may install packages into a different Python interpreter than the project's virtual environment.

Safer approach:

```bash
venv\Scripts\python.exe -m pip install package-name
```

This guarantees that the package is installed into the active virtual environment.

---

## Result

Example run:

```text
Fetching: pallets/flask
Found 111 files
Fetched 111 files successfully

First file:
.github/ISSUE_TEMPLATE/bug-report.md
```

The ingestion pipeline successfully discovers and downloads repository files for later chunking, embedding generation, and vector indexing.

---

## Files Created

```text
backend/
└── app/
    ├── __init__.py
    └── ingestion/
        ├── __init__.py
        └── github_fetcher.py
```

---

## Key Takeaways

- Learned how to traverse repositories efficiently using the GitHub Tree API.
- Understood why Base64 encoding is used for file transmission.
- Improved performance significantly through asynchronous fetching.
- Reduced retrieval noise through extension and directory filtering.
- Solved common virtual-environment issues on Windows.
- Completed the first stage of the DevDocs AI ingestion pipeline.

# Entry 2 — Chunking

**Date:** June 2026
**Status:** ✅ Complete

---

# What We Built

Implemented:

```text
backend/app/ingestion/chunker.py
```

This module serves as the second stage of the ingestion pipeline.

Its responsibilities are:

1. Receive the repository files collected by the GitHub fetcher.
2. Split large files into smaller, searchable pieces.
3. Preserve context between chunks using overlap.
4. Return a collection of chunks ready for embedding generation.

Example output:

```text
111 files → 530 chunks
```

Each chunk contains approximately **1,500 characters** of content.

---

# What I Learned

## 1. Why Chunking Is Necessary

A typical source file can be hundreds or even thousands of lines long.

For example:

```text
app.py → 800+ lines
```

Embedding an entire file as a single unit creates several problems:

### Size Limits

Embedding models have input size constraints.

Large files may exceed those limits or produce embeddings that are too broad to be useful.

### Poor Retrieval Precision

If every question retrieves an 800-line file, the relevant answer gets buried in noise.

When a user asks:

> "How does route registration work?"

they need the specific section that handles routing, not the entire application.

### Better Context Matching

Smaller chunks allow the retrieval system to find the exact code relevant to a question, improving both relevance and response quality.

---

## 2. What a Chunk Actually Is

A chunk is simply a small slice of a file.

Configuration:

```python
chunk_size = 1500
overlap = 200
```

This means:

- Each chunk contains roughly 1,500 characters.
- Consecutive chunks share the last 200 characters.

Example:

```text
Chunk 1
[--------------1500 chars--------------]

Chunk 2
                     [----200 overlap----|------new content------]
```

The overlap prevents important information from being lost at chunk boundaries.

If a function begins near the end of one chunk and continues into the next, both chunks still contain enough context to make retrieval meaningful.

---

## 3. The First Approach: Tree-Sitter

Initially, we explored using **tree-sitter**.

Tree-sitter is a syntax-aware parser capable of understanding programming language structure.

Instead of splitting by character count, it can split code into meaningful units such as:

```text
Chunk 1 → class Flask
Chunk 2 → def run()
Chunk 3 → def route()
```

This is generally considered the ideal approach because each chunk represents a complete code construct.

Benefits include:

- Better semantic boundaries
- Cleaner retrieval results
- Improved context quality

---

## 4. Why We Switched to Text Splitting

While integrating tree-sitter, we encountered dependency conflicts between:

```text
tree-sitter-languages
LlamaIndex 0.14
```

Rather than spending days debugging package compatibility issues, we chose a simpler solution.

We implemented a custom line-based chunker with:

- Zero additional dependencies
- Minimal complexity
- Predictable behavior

For a portfolio project and learning exercise, the practical benefits outweighed the theoretical advantages of syntax-aware chunking.

### Key Lesson

> Don't let tooling problems block progress. A working solution is more valuable than a perfect one that never ships.

---

## 5. How the Chunker Works

Configuration:

```python
chunk_size = 1500
overlap = 200
```

Process:

1. Read the file line by line.
2. Build the current chunk until it reaches approximately 1,500 characters.
3. Save the chunk.
4. Keep the final 200 characters.
5. Start the next chunk with that overlap.
6. Continue until the file is fully processed.

Pseudo-flow:

```text
File
 ├─ Chunk 1
 ├─ Chunk 2
 ├─ Chunk 3
 ├─ Chunk 4
 └─ ...
```

The algorithm is language-agnostic and works with any repository.

---

## 6. Repository Agnostic Design

The chunker has no knowledge of Flask, React, FastAPI, or any specific framework.

It simply processes text.

Examples:

```text
facebook/react      → ~2000 chunks
microsoft/vscode   → thousands of chunks
your-project       → however many chunks are needed
```

Because the chunking logic is generic, the same pipeline can index virtually any GitHub repository.

---

# Result

Example output:

```text
Files:  111
Chunks: 530

src/flask/app.py → 51 chunks
```

The repository is now transformed into retrieval-friendly units that can be embedded and stored in a vector database.

---

# Files Created

```text
backend/
└── app/
    └── ingestion/
        ├── github_fetcher.py  ✅ (Step 1)
        └── chunker.py         ✅ (Step 2)
```

---

# Key Takeaways

- Learned why chunking is essential for RAG systems.
- Understood the trade-off between chunk size and retrieval precision.
- Explored syntax-aware chunking with Tree-sitter.
- Encountered real-world dependency conflicts and chose a practical alternative.
- Built a lightweight chunking solution with overlap support.
- Completed the second stage of the DevDocs AI ingestion pipeline.

Entry 3 — Embeddings

Date: June 2026
Status: ✅ Complete

What We Built

Implemented:

backend/app/ingestion/embedder.py

This module serves as the third stage of the ingestion pipeline.

Its responsibilities are:

Receive the chunks generated by the chunker.
Convert each chunk into a numerical vector representation.
Attach the generated embedding to each chunk.
Return embedding-ready data for storage in the vector database.

Example output:

530 chunks → 530 embeddings

Each chunk is transformed into a vector containing 384 numerical values.

What I Learned

1. What an Embedding Actually Is

An embedding is a numerical representation of the meaning of a piece of text.

Instead of storing text directly, the embedding model converts text into a vector of numbers that captures semantic meaning.

Example:

"def authenticate(user, password)"
→ [0.21, 0.84, 0.03, ...]

"where is login logic?"
→ [0.19, 0.81, 0.05, ...]

"def calculate_tax(amount)"
→ [0.92, 0.11, 0.73, ...]

Although the first two examples use completely different words, they represent similar concepts and therefore produce vectors that are close together in vector space.

The tax calculation example represents a different concept, so its vector is located farther away.

This is the foundation of semantic search.

Instead of relying on exact keyword matches, retrieval works by finding vectors with similar meanings.

2. How Semantic Search Works

Traditional search engines rely heavily on matching words.

For example:

Question:
"Where is the login logic?"

A keyword-based search may fail if the code uses:

def authenticate_user():

because the word "login" never appears.

Embedding-based search succeeds because:

"login"
"authentication"
"sign in"
"user verification"

all have related meanings and therefore generate similar vector representations.

This allows the retrieval system to find relevant code even when the wording differs.

3. Why We Chose all-MiniLM-L6-v2

Model used:

sentence-transformers/all-MiniLM-L6-v2

Reasons for choosing it:

Compact Size
384 dimensions
≈ 90 MB model size

Small enough to run efficiently on a local machine while still providing strong retrieval quality.

Completely Free
No API key required
No usage limits
No per-request costs

Once downloaded, the model runs entirely offline.

Fast Inference

Embedding generation is quick, making it ideal for development and portfolio projects.

Production Upgrade Path

For larger production systems, a stronger embedding model such as:

all-mpnet-base-v2

could provide higher retrieval accuracy at the cost of additional memory and processing time.

4. Understanding the 384 Dimensions

Each embedding contains:

384 floating-point values

Example:

[-0.043, -0.004, 0.008, 0.078, 0.172, ...]

The individual numbers are not directly meaningful to humans.

What matters is the relationship between vectors.

When two vectors point in similar directions, they represent similar meanings.

Later in the pipeline, pgvector will compare these vectors using similarity calculations to find the most relevant chunks for a user's question.

5. Why Batch Processing Matters

Initially, embeddings could be generated one chunk at a time:

for chunk in chunks:
model.encode(chunk)

However, this is inefficient.

Instead, we process multiple chunks together:

batch_size = 32

For our dataset:

530 chunks ÷ 32
≈ 17 batches

This explains the progress output:

17/17

Batch processing allows the model to utilize hardware more efficiently and significantly reduces total embedding time.

6. The Hugging Face Warning

During the first run, the following warning appeared:

Warning: You are sending unauthenticated requests to the HF Hub

This warning is harmless.

It simply means the model is being downloaded without a Hugging Face account or authentication token.

Effects:

Slightly slower initial download
No impact on model quality
No impact on embedding generation

Once the model is cached locally, future runs require no downloads and no internet connection.

7. Why Embeddings Are the Core of RAG

At this stage, the pipeline has transformed:

Raw code
↓
Chunks
↓
Embeddings

The original code is still preserved, but now every chunk has a machine-understandable representation.

This enables:

Semantic search
Similarity matching
Context retrieval
Question answering over large repositories

Without embeddings, the retrieval part of Retrieval-Augmented Generation would not be possible.

Result

Example output:

Chunks embedded: 530
Embedding length: 384 numbers

First 5 values:
[-0.043, -0.004, 0.008, 0.078, 0.172]

Every chunk in the repository now has a corresponding vector representation and is ready to be stored in a vector database.

Files Created
backend/
└── app/
└── ingestion/
├── github_fetcher.py ✅ (Step 1)
├── chunker.py ✅ (Step 2)
└── embedder.py ✅ (Step 3)
Key Takeaways
Learned how embedding models convert text into numerical vector representations.
Understood the difference between semantic search and keyword search.
Explored how vector similarity enables retrieval of relevant code.
Integrated the all-MiniLM-L6-v2 embedding model.
Improved embedding performance through batch processing.
Learned how Hugging Face model downloads and caching work.
Completed the third stage of the DevDocs AI ingestion pipeline.
Pipeline Progress
GitHub Repository
↓
GitHub Fetcher ✅
↓
Chunker ✅
↓
Embedder ✅
↓
Vector Database ⏳ Next Step
↓
Retriever
↓
LLM Response

Entry 4 — Vector Storage + Semantic Search
Date: June 2026
Status: ✅ Complete
What we built
backend/app/ingestion/store.py — saves all chunks + embeddings to Postgres and searches them by meaning.
Also: installed pgvector extension on Postgres 18 (Windows), created the chunks table with a vector index.
What I learned
What pgvector is:
pgvector is a Postgres extension that adds one new data type: vector(384).
This lets Postgres store and search embeddings natively — no separate vector database needed.
You already know Postgres. Now it's also your vector database.
The chunks table:
sqlCREATE TABLE chunks (
id SERIAL PRIMARY KEY,
repo TEXT, -- e.g. "pallets/flask"
file_path TEXT, -- e.g. "src/flask/app.py"
content TEXT, -- the actual code text
embedding vector(384), -- the 384 numbers
created_at TIMESTAMPTZ
);
What the ivfflat index does:
sqlCREATE INDEX ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
Without this index, every search scans all 530 rows and computes distance to each one.
With the index, Postgres groups vectors into 100 clusters and only searches the nearest clusters.
At 530 rows it doesn't matter much — at 500,000 rows it's the difference between 2ms and 10 seconds.
How cosine similarity search works:
The <=> operator in Postgres computes cosine distance between two vectors.
Cosine distance 0 = identical meaning. Cosine distance 1 = completely different.
We convert to similarity: 1 - distance, so 1.0 = perfect match, 0.0 = no match.
The pgvector Windows installation problem:
The official pgvector requires compiling from source with Visual Studio on Windows.
For Postgres 18, a community member (andreiramani) pre-compiled it:
https://github.com/andreiramani/pgvector_pgsql_windows/releases
Copy .dll to lib/, copy .control + .sql files to share/extension/, restart Postgres service.
What clear_repo does and why:
Before re-indexing a repo, we delete all existing chunks for it.
Without this, every time you re-run the indexer you'd get duplicate rows.
Result
Saving 530 chunks to database...
Done. 530 chunks saved.

SEARCH RESULTS for: 'how does flask handle routing?'
Result 1: src/flask/app.py similarity: 0.713
Result 2: tests/.../hello.py similarity: 0.694
Result 3: tests/test_blueprints.py similarity: 0.609
No keywords matched. Pure semantic search — it understood the meaning of the question
and found the right code files. This is the core of the entire RAG system working.
Files created
backend/
└── app/
└── ingestion/
├── github_fetcher.py ✅ (Step 1)
├── chunker.py ✅ (Step 2)
├── embedder.py ✅ (Step 3)
└── store.py ✅ (Step 4)

Entry 5 — Query Pipeline
Date: June 2026
Status: ✅ Complete
What we built
backend/app/query/pipeline.py — the brain of the entire project.
Takes a natural language question + repo name → searches pgvector → feeds results to Groq LLM → returns a real answer with file citations.
What I learned
The full query flow:
User question
↓ embed with same model (all-MiniLM-L6-v2)
Query vector (384 numbers)
↓ cosine similarity search in pgvector
Top 5 most relevant chunks
↓ build a prompt with chunks as context
Prompt sent to Groq (llama-3.3-70b-versatile)
↓
Answer with file citations
Why we use the same embedding model for queries:
The query and the chunks must live in the same vector space.
If you embedded chunks with all-MiniLM-L6-v2, you must embed queries with it too.
Using a different model would be like translating English chunks to French, then searching in German — meaningless.
What temperature=0.1 means:
LLMs have a "temperature" setting that controls creativity vs precision.

temperature=1.0 → creative, varied, sometimes hallucinates
temperature=0.1 → precise, consistent, sticks to the facts
For a code assistant, you want low temperature — you want accurate answers, not creative ones.

Why "Use ONLY the code excerpts provided" in the prompt:
This is called grounding. Without it, the LLM might answer from its own training data
(it knows Flask already) instead of from your codebase.
The instruction forces it to only use what you retrieved — making it a true RAG system.
Why Groq instead of Gemini:
Groq runs LLaMA models on custom hardware (LPUs — Language Processing Units).
Response time is ~300ms vs ~2-3 seconds for most other providers.
Free tier is generous enough for a portfolio project.
llama-3.3-70b-versatile = 70 billion parameter model, excellent at code understanding.
What similarity scores mean in practice:

0.7+ → very relevant, almost certainly the right code
0.5-0.7 → probably relevant
below 0.3 → weak match, the answer might not be in the codebase

The "request context" question had low scores (0.35, 0.28) — meaning the chunks
retrieved weren't perfectly relevant. This is a signal that retrieval quality
could be improved with hybrid search (BM25 + vector) in a future iteration.
Result
Q: How do I create a blueprint in Flask?

ANSWER: To create a blueprint, use the Blueprint class from flask.
In tests/test_apps/blueprintapp/apps/frontend/**init**.py:
frontend = Blueprint("frontend", **name**, template_folder="templates")
The Blueprint class is defined in src/flask/sansio/blueprints.py...

SOURCES:

- src/flask/sansio/blueprints.py (similarity: 0.617)
- src/flask/**init**.py (similarity: 0.570)
- tests/.../admin/**init**.py (similarity: 0.566)
  Real code. Real file paths. Real answer. No hallucination.
  Files created
  backend/
  └── app/
  ├── ingestion/
  │ ├── github_fetcher.py ✅ (Step 1)
  │ ├── chunker.py ✅ (Step 2)
  │ ├── embedder.py ✅ (Step 3)
  │ └── store.py ✅ (Step 4)
  └── query/
  ├── **init**.py
  └── pipeline.py ✅ (Step 5)

Entry 6 — FastAPI Backend

Date: June 2026
Status: ✅ Complete

What we built

backend/app/main.py — wraps the entire pipeline into two HTTP endpoints.

POST /index — takes a GitHub URL, runs full ingestion pipeline
POST /query — takes a question + repo, returns answer with citations
GET /docs — automatic interactive API documentation (free with FastAPI)

What I learned

What FastAPI is:
FastAPI is a Python web framework for building APIs. It's fast, modern, and
automatically generates interactive documentation from your code.
You write Python functions, add decorators, and FastAPI handles HTTP.

What an endpoint is:
An endpoint is a URL your frontend can send data to and get data back from.

Frontend → POST /index { repo_url: "..." } → Backend runs ingestion → returns { chunks_stored: 530 }
Frontend → POST /query { question: "...", repo: "..." } → Backend runs RAG → returns { answer, sources }

What Pydantic models do:

pythonclass QueryRequest(BaseModel):
question: str
repo: str

This defines exactly what data the endpoint expects.
If the frontend sends wrong data, FastAPI automatically returns a clear error.
No manual validation needed.

What CORS is and why we need it:
CORS (Cross-Origin Resource Sharing) is a browser security rule.
By default, a browser blocks localhost:3000 (Next.js) from talking to localhost:8000 (FastAPI)
because they're on different ports — treated as different "origins".

pythonapp.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"])

This tells FastAPI: "it's okay, let the frontend talk to you."

What uvicorn is:
Uvicorn is the server that actually runs FastAPI.
--reload means it automatically restarts when you change code — useful during development.

The /docs page:
Go to http://localhost:8000/docs — FastAPI auto-generates a full interactive UI
where you can test every endpoint directly in the browser. No Postman needed.
This is called Swagger UI and it's generated automatically from your Pydantic models.

Result

Uvicorn running on http://127.0.0.1:8000

GET / → {"status": "DevDocs AI is running"}
POST /index → indexes any GitHub repo
POST /query → answers questions with citations
GET /docs → interactive API documentation

Files created

backend/
└── app/
├── ingestion/
│ ├── github_fetcher.py ✅
│ ├── chunker.py ✅
│ ├── embedder.py ✅
│ └── store.py ✅
├── query/
│ └── pipeline.py ✅
└── main.py ✅ (Step 6)

Entry 7 — Next.js Frontend

Date: June 2026
Status: ✅ Complete

What we built

frontend/app/page.tsx — the entire UI in one file.

Two-step interface:

Paste a GitHub URL → click Index → wait 2-3 minutes → repo is indexed
Type a question → press Enter or click Ask → get answer with source citations

What I learned

"use client" at the top:
Next.js by default renders pages on the server.
"use client" tells Next.js: this page uses browser features (useState, event handlers)
so render it in the browser. Required for any interactive page.

useState for UI state:

typescriptconst [indexing, setIndexing] = useState(false);
const [result, setResult] = useState<QueryResult | null>(null);

Every piece of UI state is a useState hook.
When state changes, React automatically re-renders the affected parts.

Talking to the FastAPI backend:

typescriptconst res = await fetch(`${API}/query`, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ question, repo: indexedRepo }),
});

Standard browser fetch API. Same pattern works in any JavaScript project.

TypeScript interfaces for API responses:

typescriptinterface QueryResult {
answer: string;
sources: Source[];
}

This tells TypeScript exactly what shape the API response has.
If you try to access result.wrongField, TypeScript catches it at compile time.

Disabled states:
The Ask button and question input are disabled until a repo is indexed.
The Index button is disabled while indexing is in progress.
This prevents the user from doing things in the wrong order.

The sources panel:
Each source shows:

File path in blue monospace font
Similarity score as a percentage
First 150 characters of the chunk as a preview
This is what makes it a RAG UI, not just a chatbot.

The full project structure

devdocs-ai/
├── .env
├── backend/
│ └── app/
│ ├── main.py
│ ├── ingestion/
│ │ ├── github_fetcher.py
│ │ ├── chunker.py
│ │ ├── embedder.py
│ │ └── store.py
│ └── query/
│ └── pipeline.py
└── frontend/
└── app/
└── page.tsx

How to run the full project

bash# Terminal 1 — backend
cd backend
venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000

# Terminal 2 — frontend

cd frontend
npm run dev

Then open http://localhost:3000

Entry 8 — The psycopg2 Vector Search Bug (Debugging Log)

Date: June 2026
Status: 🔧 In Progress

What broke

After the full pipeline worked perfectly in the terminal test (store.py direct test),
the same search returned 0 results when called through FastAPI.

The symptom:

DEBUG: total chunks for repo 'BhargavGarge/StockSense' = 153 ← data IS there
DEBUG store: rows returned = 0 ← but search finds nothing

What we ruled out one by one

Not a data problem.
Running SELECT content FROM chunks WHERE repo = '...' LIMIT 1 in pgAdmin returned rows fine.
153 chunks confirmed in the database.

Not a vector type problem.
Running SELECT pg_typeof(embedding) FROM chunks LIMIT 1 returned vector.
The embeddings are stored correctly as pgvector type.

Not a SQL problem.
Running the cosine similarity search directly in pgAdmin worked perfectly:

sqlSELECT file_path, 1 - (embedding <=> ...) AS similarity
FROM chunks ORDER BY similarity DESC LIMIT 5;

Returned correct results with good similarity scores.

The actual problem — psycopg2 parameter quoting.
When you pass a string as a %s parameter in psycopg2, it automatically wraps it in quotes:

python# What you write:
cur.execute("... embedding <=> %s::vector ...", (embedding_str,))

# What psycopg2 actually sends to Postgres:

... embedding <=> '[0.1, 0.2, ...]'::vector ...

# ↑ quotes added by psycopg2 ↑

The quotes make '[0.1,0.2]'::vector — which Postgres silently rejects or mishandles,
returning 0 rows instead of an error. Very hard to debug because no error is thrown.

What we tried

f-string injection — embed the vector directly in the SQL string (bypasses psycopg2 quoting)

python query = f"... embedding <=> '{embedding_str}'::vector ..."

Still returned 0 rows — unclear why.

Manual type registration — register the pgvector type with psycopg2 manually
Still returned 0 rows.

The fix — pgvector Python package

The correct solution is to use the official pgvector Python package,
which handles all type registration and parameter passing automatically:

pythonfrom pgvector.psycopg2 import register_vector
import numpy as np

conn = psycopg2.connect(DATABASE_URL)
register_vector(conn) # tells psycopg2 how to handle vector type

# Now you can pass numpy arrays directly — no casting needed

cur.execute("... embedding <=> %s ...", (np.array(query_embedding),))

What I learned from this bug

The lesson: When a query works in pgAdmin but returns wrong results from Python,
the problem is almost always in how the database driver (psycopg2) serializes the parameters.
Different types need different handling. Always use the official driver package for custom types.

The debugging process:

Confirm data exists → SELECT COUNT(\*)
Confirm data type is correct → SELECT pg_typeof()
Confirm SQL works directly → run in pgAdmin
Isolate the Python driver → add debug prints at every step
Google the exact combination: psycopg2 pgvector parameter passing

This is real engineering. Things break at integration points between libraries.
Debugging it systematically — rather than randomly changing things — is the skill.
