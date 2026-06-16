# backend/app/ingestion/store.py

import psycopg2
import os
import numpy as np
from dotenv import load_dotenv
from pgvector.psycopg2 import register_vector

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Single persistent connection — register_vector once
_conn = None

def get_connection():
    global _conn
    if _conn is None or _conn.closed:
        _conn = psycopg2.connect(DATABASE_URL)
        register_vector(_conn)
    return _conn


def clear_repo(repo: str):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM chunks WHERE repo = %s", (repo,))
    conn.commit()
    cur.close()


def save_chunks(repo: str, chunks: list[dict]):
    conn = get_connection()
    cur = conn.cursor()
    print(f"Saving {len(chunks)} chunks to database...")
    for chunk in chunks:
        cur.execute(
            "INSERT INTO chunks (repo, file_path, content, embedding) VALUES (%s, %s, %s, %s)",
            (repo, chunk["path"], chunk["content"], np.array(chunk["embedding"]))
        )
    conn.commit()
    cur.close()
    print(f"Done. {len(chunks)} chunks saved.")


def search_chunks(query_embedding: list[float], repo: str, top_k: int = 8) -> list[dict]:
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT file_path, content,
               1 - (embedding <=> %s) AS similarity
        FROM chunks
        WHERE repo = %s
        ORDER BY embedding <=> %s
        LIMIT %s
        """,
        (np.array(query_embedding), repo, np.array(query_embedding), top_k)
    )

    rows = cur.fetchall()
    cur.close()

    print(f"DEBUG store: rows returned = {len(rows)}")

    return [
        {"file_path": row[0], "content": row[1], "similarity": row[2]}
        for row in rows
    ]