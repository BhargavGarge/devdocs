# backend/app/query/pipeline.py

import os
from dotenv import load_dotenv
from groq import Groq
from app.ingestion.embedder import model as embedding_model
from app.ingestion.store import search_chunks

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def answer_question(question: str, repo: str) -> dict:
    # Step 1: embed the question
    query_embedding = embedding_model.encode(question).tolist()

    # Step 2: retrieve top 8 relevant chunks
    chunks = search_chunks(query_embedding, repo, top_k=8)
    print(f"DEBUG: repo='{repo}', chunks found={len(chunks)}")

    if not chunks:
        return {
            "answer": "The repo has not been indexed yet. Please index it first.",
            "sources": []
        }

    # Step 3: build context from chunks
    context = ""
    for i, chunk in enumerate(chunks):
        context += f"\n--- File: {chunk['file_path']} (similarity: {chunk['similarity']:.2f}) ---\n"
        context += chunk["content"]
        context += "\n"

    # Step 4: build the prompt
    prompt = f"""You are a helpful code assistant analyzing a GitHub repository.
First figure out what kind of project this is (web app, mobile app, library, etc.) from the code.
Then answer the question based ONLY on the code excerpts provided.
Always mention which file the relevant code is in.
If you can't find a direct answer, explain what the provided code DOES show and suggest what to look for.
Never say "not provided" without also explaining what you DID find.

QUESTION:
{question}

RELEVANT CODE FROM THE CODEBASE:
{context}

ANSWER:"""

    # Step 5: ask Groq
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1024,
        temperature=0.1
    )

    answer = response.choices[0].message.content

    return {
        "answer": answer,
        "sources": [
            {
                "file_path": c["file_path"],
                "similarity": round(c["similarity"], 3),
                "preview": c["content"][:150]
            }
            for c in chunks
        ]
    }


if __name__ == "__main__":
    REPO = "pallets/flask"

    questions = [
        "How does Flask handle routing?",
        "Where is the request context managed?",
        "How do I create a blueprint in Flask?",
    ]

    for question in questions:
        print(f"\n{'='*60}")
        print(f"Q: {question}")
        print('='*60)

        result = answer_question(question, REPO)

        print(f"\nANSWER:\n{result['answer']}")
        print(f"\nSOURCES:")
        for s in result["sources"]:
            print(f"  - {s['file_path']} (similarity: {s['similarity']})")