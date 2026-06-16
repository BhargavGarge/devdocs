const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface IndexResponse {
  repo: string;
  files_found: number;
  chunks_stored: number;
  message: string;
}

export interface Source {
  file_path: string;
  similarity: number;
  content: string;
}

export interface QueryResponse {
  answer: string;
  sources: Source[];
}

export async function indexRepo(repoUrl: string): Promise<IndexResponse> {
  const res = await fetch(`${API_BASE}/index`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo_url: repoUrl }),
  });
  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      detail = JSON.parse(text)?.detail ?? text;
    } catch {
      // raw text is fine
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function queryRepo(question: string, repo: string): Promise<QueryResponse> {
  const res = await fetch(`${API_BASE}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, repo }),
  });
  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      detail = JSON.parse(text)?.detail ?? text;
    } catch {
      // raw text is fine
    }
    throw new Error(detail);
  }
  return res.json();
}
