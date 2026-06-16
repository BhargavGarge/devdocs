# backend/app/ingestion/embedder.py

from sentence_transformers import SentenceTransformer

# Load model once — this downloads ~80MB on first run, then caches it
model = SentenceTransformer("all-MiniLM-L6-v2")


def embed_chunks(chunks: list[dict]) -> list[dict]:
    """
    Takes list of { path, content, chunk_index } from chunker.
    Returns same list but each chunk now has an 'embedding' key —
    a list of 384 numbers representing the chunk's meaning.
    """
    texts = [chunk["content"] for chunk in chunks]

    print(f"Embedding {len(texts)} chunks...")
    embeddings = model.encode(
        texts,
        batch_size=32,        # process 32 chunks at a time
        show_progress_bar=True
    )

    for chunk, embedding in zip(chunks, embeddings):
        chunk["embedding"] = embedding.tolist()  # numpy array → plain list

    return chunks


# Test
if __name__ == "__main__":
    import asyncio
    from app.ingestion.github_fetcher import fetch_repo
    from app.ingestion.chunker import chunk_files

    async def test():
        print("Step 1: fetching...")
        files = await fetch_repo("https://github.com/pallets/flask")

        print("Step 2: chunking...")
        chunks = chunk_files(files)
        # Test with first 20 chunks only — no need to embed all 530 for a test
        sample = chunks[:20]

        print("Step 3: embedding...")
        embedded = embed_chunks(sample)

        print(f"\n--- RESULT ---")
        print(f"Chunks embedded: {len(embedded)}")
        print(f"First chunk path: {embedded[0]['path']}")
        print(f"Embedding length: {len(embedded[0]['embedding'])} numbers")
        print(f"First 5 numbers: {embedded[0]['embedding'][:5]}")

    asyncio.run(test())