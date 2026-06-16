# backend/app/ingestion/chunker.py

def chunk_text(content: str, file_path: str, chunk_size: int = 1500, overlap: int = 200) -> list[dict]:
    lines = content.split("\n")
    chunks = []
    current_chunk = []
    current_size = 0
    chunk_index = 0

    for line in lines:
        line_size = len(line) + 1

        if current_size + line_size > chunk_size and current_chunk:
            chunks.append({
                "path": file_path,
                "content": f"File: {file_path}\n\n" + "\n".join(current_chunk),
                "chunk_index": chunk_index
            })
            chunk_index += 1

            overlap_lines = []
            overlap_size = 0
            for l in reversed(current_chunk):
                if overlap_size + len(l) < overlap:
                    overlap_lines.insert(0, l)
                    overlap_size += len(l)
                else:
                    break

            current_chunk = overlap_lines
            current_size = overlap_size

        current_chunk.append(line)
        current_size += line_size

    # Last chunk
    if current_chunk:
        chunks.append({
            "path": file_path,
            "content": f"File: {file_path}\n\n" + "\n".join(current_chunk),
            "chunk_index": chunk_index
        })

    return chunks


def chunk_files(files: list[dict]) -> list[dict]:
    all_chunks = []
    for file in files:
        chunks = chunk_text(file["content"], file["path"])
        all_chunks.extend(chunks)
    return all_chunks


if __name__ == "__main__":
    import asyncio
    from app.ingestion.github_fetcher import fetch_repo

    async def test():
        print("Fetching files...")
        files = await fetch_repo("https://github.com/pallets/flask")
        print("Chunking...")
        chunks = chunk_files(files)
        print(f"\n--- RESULT ---")
        print(f"Files:  {len(files)}")
        print(f"Chunks: {len(chunks)}")
        print(f"\nFirst chunk preview:\n{chunks[0]['content'][:300]}")

    asyncio.run(test())