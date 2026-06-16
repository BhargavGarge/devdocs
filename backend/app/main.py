# backend/app/main.py

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import os
from dotenv import load_dotenv

from app.ingestion.github_fetcher import fetch_repo
from app.ingestion.chunker import chunk_files
from app.ingestion.embedder import embed_chunks
from app.ingestion.store import clear_repo, save_chunks
from app.query.pipeline import answer_question

load_dotenv()

app = FastAPI(title="DevDocs AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class IndexRequest(BaseModel):
    repo_url: str

class IndexResponse(BaseModel):
    repo: str
    files_found: int
    chunks_stored: int
    message: str

class QueryRequest(BaseModel):
    question: str
    repo: str

class QueryResponse(BaseModel):
    answer: str
    sources: list[dict]


@app.get("/")
def root():
    return {"status": "DevDocs AI is running"}


@app.post("/index", response_model=IndexResponse)
async def index_repo(request: IndexRequest):
    try:
        repo_url = request.repo_url.rstrip("/").replace("https://github.com/", "")
        parts = repo_url.split("/")
        if len(parts) < 2:
            raise HTTPException(status_code=400, detail="Invalid GitHub URL")
        repo = f"{parts[0]}/{parts[1]}"

        files = await fetch_repo(request.repo_url)
        chunks = chunk_files(files)
        embedded = embed_chunks(chunks)
        clear_repo(repo)
        save_chunks(repo, embedded)

        return IndexResponse(
            repo=repo,
            files_found=len(files),
            chunks_stored=len(embedded),
            message=f"Successfully indexed {repo}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query", response_model=QueryResponse)
def query_repo(request: QueryRequest):
    try:
        result = answer_question(request.question, request.repo)
        return QueryResponse(
            answer=result["answer"],
            sources=result["sources"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query/stream")
async def query_stream(request: QueryRequest):
    from app.ingestion.embedder import model as embedding_model
    from app.ingestion.store import search_chunks

    # Do search OUTSIDE generate() — uses the already-registered connection
    query_embedding = embedding_model.encode(request.question).tolist()
    chunks = search_chunks(query_embedding, request.repo, top_k=8)

    def generate():
        from groq import Groq

        if not chunks:
            yield f"data: {json.dumps({'type': 'error', 'content': 'No relevant code found.'})}\n\n"
            return

        sources = [
            {
                "file_path": c["file_path"],
                "similarity": round(c["similarity"], 3),
                "preview": c["content"][:150]
            }
            for c in chunks
        ]
        yield f"data: {json.dumps({'type': 'sources', 'content': sources})}\n\n"

        context = ""
        for chunk in chunks:
            context += f"\nFile: {chunk['file_path']}\n{chunk['content']}\n"

        prompt = f"""You are a helpful code assistant analyzing a GitHub repository.
Figure out what kind of project this is from the code.
Answer the question based ONLY on the code excerpts provided.
Always mention which file the relevant code is in.
If you can't find a direct answer, explain what the provided code DOES show.

QUESTION:
{request.question}

RELEVANT CODE:
{context}

ANSWER:"""

        client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        stream = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1024,
            temperature=0.1,
            stream=True
        )

        for chunk in stream:
            token = chunk.choices[0].delta.content
            if token:
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )