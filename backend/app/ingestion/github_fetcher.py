import httpx
import base64
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
HEADERS = {"Authorization": f"Bearer {GITHUB_TOKEN}"}

CODE_EXTENSIONS = {
    ".py", ".ts", ".js", ".tsx", ".jsx",
    ".md", ".txt", ".yaml", ".toml"
}

SKIP_DIRS = {
    "node_modules", "dist", "build", "__pycache__",
    ".git", ".next", "venv", ".venv"
}


def should_skip(path: str) -> bool:
    parts = path.split("/")
    return any(part in SKIP_DIRS for part in parts)


def has_valid_extension(path: str) -> bool:
    return any(path.endswith(ext) for ext in CODE_EXTENSIONS)


async def get_file_tree(client, owner, repo):
    url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/HEAD"
    res = await client.get(url, params={"recursive": "1"}, headers=HEADERS)
    res.raise_for_status()
    data = res.json()

    return [
        item for item in data["tree"]
        if item["type"] == "blob"
        and has_valid_extension(item["path"])
        and not should_skip(item["path"])
    ]


async def fetch_file_content(client, sem, file_item):
    async with sem:
        try:
            res = await client.get(file_item["url"], headers=HEADERS)
            res.raise_for_status()
            data = res.json()
            content = base64.b64decode(data["content"]).decode("utf-8", errors="ignore")
            return {
                "path": file_item["path"],
                "content": content
            }
        except Exception as e:
            print(f"Failed: {file_item['path']} — {e}")
            return None


async def fetch_repo(repo_url: str):
    repo_url = repo_url.rstrip("/").replace("https://github.com/", "")
    owner, repo = repo_url.split("/")[:2]

    print(f"Fetching: {owner}/{repo}")

    async with httpx.AsyncClient(timeout=30) as client:
        files = await get_file_tree(client, owner, repo)
        print(f"Found {len(files)} files")

        sem = asyncio.Semaphore(10)
        results = await asyncio.gather(*[
            fetch_file_content(client, sem, f)
            for f in files
        ])

    files_data = [r for r in results if r is not None]
    print(f"Fetched {len(files_data)} files successfully")
    return files_data


# This runs when you execute this file directly
if __name__ == "__main__":
    async def test():
        files = await fetch_repo("https://github.com/pallets/flask")
        print(f"\n--- RESULT ---")
        print(f"Total files: {len(files)}")
        print(f"First file path: {files[0]['path']}")
        print(f"First 200 chars:\n{files[0]['content'][:200]}")

    asyncio.run(test())