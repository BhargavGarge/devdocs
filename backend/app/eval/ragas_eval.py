# backend/app/eval/ragas_eval.py
#
# Custom RAG evaluator — measures faithfulness, answer relevancy, and context
# recall using an LLM-as-judge (Groq). The metric definitions follow the
# RAGAS paper/framework (https://github.com/explodinggradients/ragas), but
# this file does NOT call into the `ragas` package's own evaluate()/metrics —
# it's a hand-rolled implementation of the same three scores. See the
# "Evaluation" section in the root README for the full caveat.

import os
from dotenv import load_dotenv
from groq import Groq
from app.ingestion.embedder import model as embedding_model
from app.ingestion.store import search_chunks

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

REPO = "pallets/flask"

TEST_DATA = [
    {
        "question": "How does Flask handle routing?",
        "ground_truth": "Flask handles routing using the @app.route decorator which maps URL patterns to view functions using Werkzeug's routing system."
    },
    {
        "question": "How do I create a blueprint in Flask?",
        "ground_truth": "Blueprints are created using the Blueprint class with a name and import_name, optionally with url_prefix and template_folder."
    },
    {
        "question": "Where is the request context managed in Flask?",
        "ground_truth": "The request context is managed in src/flask/ctx.py and is pushed and popped around each request."
    },
    {
        "question": "How does Flask handle JSON responses?",
        "ground_truth": "Flask handles JSON in src/flask/json/ using the jsonify function and a customizable JSON provider system."
    },
    {
        "question": "What is the Flask CLI and how do I use it?",
        "ground_truth": "The Flask CLI is defined in src/flask/cli.py and provides commands like flask run and flask shell."
    },
    {
        "question": "How does Flask session management work?",
        "ground_truth": "Flask sessions are managed in src/flask/sessions.py using SecureCookieSessionInterface which signs data with the app secret key."
    },
    {
        "question": "How does Flask testing work?",
        "ground_truth": "Flask testing uses app.test_client() defined in testing.py which simulates HTTP requests. Tests use pytest with fixtures in conftest.py."
    },
    {
        "question": "How does Flask handle static files?",
        "ground_truth": "Flask serves static files via the send_static_file method in scaffold. The static folder and URL path are configurable."
    },
]


def run_pipeline(question: str) -> tuple[str, list[str]]:
    """Run RAG pipeline, return (answer, list_of_context_chunks)."""
    query_embedding = embedding_model.encode(question).tolist()
    chunks = search_chunks(query_embedding, REPO, top_k=5)

    if not chunks:
        return "No relevant code found.", []

    context = "\n".join([
        f"File: {c['file_path']}\n{c['content']}"
        for c in chunks
    ])

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": f"""Answer based ONLY on the code below.
Mention the file name in your answer.

QUESTION: {question}

CODE:
{context}

ANSWER:"""}],
        max_tokens=512,
        temperature=0.1
    )

    answer = response.choices[0].message.content
    contexts = [c["content"] for c in chunks]
    return answer, contexts


def score_faithfulness(question: str, answer: str, contexts: list[str]) -> float:
    """
    Ask Groq: is every claim in the answer supported by the context?
    Returns score 0.0 to 1.0
    """
    context_text = "\n---\n".join(contexts)

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": f"""You are evaluating a RAG system.

QUESTION: {question}
ANSWER: {answer}
CONTEXT (retrieved code chunks):
{context_text}

Task: What fraction of claims in the ANSWER are supported by the CONTEXT?
Reply with ONLY a number between 0.0 and 1.0.
1.0 = every claim is supported
0.0 = no claims are supported
0.5 = half the claims are supported

NUMBER:"""}],
        max_tokens=10,
        temperature=0.0
    )

    try:
        return float(response.choices[0].message.content.strip())
    except:
        return 0.5


def score_relevancy(question: str, answer: str) -> float:
    """
    Ask Groq: does the answer actually address the question?
    Returns score 0.0 to 1.0
    """
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": f"""You are evaluating a RAG system.

QUESTION: {question}
ANSWER: {answer}

Task: How well does the ANSWER address the QUESTION?
Reply with ONLY a number between 0.0 and 1.0.
1.0 = perfectly answers the question
0.0 = completely irrelevant
0.5 = partially answers the question

NUMBER:"""}],
        max_tokens=10,
        temperature=0.0
    )

    try:
        return float(response.choices[0].message.content.strip())
    except:
        return 0.5


def score_context_recall(ground_truth: str, contexts: list[str]) -> float:
    """
    Ask Groq: does the retrieved context contain what's needed to answer correctly?
    Returns score 0.0 to 1.0
    """
    context_text = "\n---\n".join(contexts)

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": f"""You are evaluating a RAG retrieval system.

EXPECTED ANSWER: {ground_truth}
RETRIEVED CONTEXT (code chunks):
{context_text}

Task: What fraction of the information needed to produce the EXPECTED ANSWER
is present in the RETRIEVED CONTEXT?
Reply with ONLY a number between 0.0 and 1.0.
1.0 = all needed information is in the context
0.0 = none of the needed information is in the context

NUMBER:"""}],
        max_tokens=10,
        temperature=0.0
    )

    try:
        return float(response.choices[0].message.content.strip())
    except:
        return 0.5


def main():
    print("=== DevDocs AI — RAG Evaluation ===")
    print(f"Repo: {REPO}")
    print(f"Test questions: {len(TEST_DATA)}\n")

    faithfulness_scores = []
    relevancy_scores = []
    recall_scores = []

    for i, item in enumerate(TEST_DATA):
        print(f"[{i+1}/{len(TEST_DATA)}] {item['question'][:55]}...")

        # Run pipeline
        answer, contexts = run_pipeline(item["question"])

        # Score
        f = score_faithfulness(item["question"], answer, contexts)
        r = score_relevancy(item["question"], answer)
        c = score_context_recall(item["ground_truth"], contexts)

        faithfulness_scores.append(f)
        relevancy_scores.append(r)
        recall_scores.append(c)

        print(f"  Faithfulness: {f:.2f} | Relevancy: {r:.2f} | Context Recall: {c:.2f}")

    # Final scores
    avg_f = sum(faithfulness_scores) / len(faithfulness_scores)
    avg_r = sum(relevancy_scores) / len(relevancy_scores)
    avg_c = sum(recall_scores) / len(recall_scores)

    print(f"\n{'='*45}")
    print(f"FINAL SCORES ({len(TEST_DATA)} questions)")
    print(f"{'='*45}")
    print(f"Faithfulness:     {avg_f:.3f}")
    print(f"Answer Relevancy: {avg_r:.3f}")
    print(f"Context Recall:   {avg_c:.3f}")
    print(f"{'='*45}")
    print("\nAdd these to your README!")


if __name__ == "__main__":
    main()