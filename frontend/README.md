# DevDocs AI — Frontend

Next.js UI for [DevDocs AI](../README.md): a landing page plus a small app
(`/app`) where you paste a GitHub repo URL, index it, and ask questions about
the codebase. Talks to the FastAPI backend in [`../backend`](../backend) via
the typed client in [`lib/api.ts`](./lib/api.ts).

See the [root README](../README.md) for the full architecture, setup for both
backend and frontend together, and the project's learning log.

## Structure

- `app/page.tsx` — marketing/landing page (`Hero`, `Features`, `HowItWorks`, `TechStack`, `CTASection`)
- `app/app/page.tsx` — the actual index → ask → answer-with-citations UI
- `lib/api.ts` — typed fetch wrappers for `/index` and `/query`

## Local development

```bash
npm install

# create .env.local with:
#   NEXT_PUBLIC_API_URL=http://localhost:8000

npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The backend (see
[`../backend`](../backend)) must be running for indexing/querying to work.

## Build

```bash
npm run build
npm run start
```
