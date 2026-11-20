# Nova developer guide

> Fictional document for demo purposes.

**Local setup:** clone the nova repository from our GitHub organisation, run `npm install`, copy `.env.example` to `.env`, then `npm run dev`. PostgreSQL runs in Docker locally.

**Repository layout:** `web/` (React + Vite), `api/` (Express), `db/` (migrations).

**Deploying:** merges to main deploy to the AWS staging account automatically. There is no production environment.

**Conventions:** TypeScript strict mode, small pull requests, every bug fix comes with a test.
