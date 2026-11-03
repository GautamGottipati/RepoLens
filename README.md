# RepoLens

**An agentic experimentation and learning environment for real software, reasoned by Meta Muse.**

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

Give RepoLens a repository URL. It investigates the codebase, works out how the
software is meant to run, maps its architecture down to cited source lines, and
turns it into something you can *use*: a Spark playground, a real CLI, a
runnable library. When you ask "why?", it prefers to **run an experiment**
over writing an essay.

> **Don't just tell. Show.**
> Models reason about measurements. Models never manufacture measurements.

```text
GitHub URL → investigate → RepoManifest → architecture (every claim cites a line)
          → build & smoke-test → interactive experience → ask "why?"
          → Muse designs an experiment → you approve → real runs → measured evidence
          → Muse explains the measured result
```

---

## Contents

- [What it does](#what-it-does)
- [How Muse is used](#how-muse-is-used)
- [Meta Model API and sandbox execution](#meta-model-api-and-sandbox-execution)
- [Quick start](#quick-start)
- [Running the project](#running-the-project)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Development and tests](#development-and-tests)
- [Project status and limitations](#project-status-and-limitations)
- [License](#license)

---

## What it does

| Screen | What you get |
|---|---|
| **Overview** | What the repository is, in plain language, and where to start. It is published progressively, so the first content appears in seconds. |
| **Experiences** | Every way to interact with the project RepoLens detected: a Spark data playground, a real `cqlsh`, a library console, a guided lesson. Each is honestly labelled as running the real repository, an official release, or a clearly marked **SIMULATED** Mini Lab. |
| **Architecture** | Overview → runtime components → flows → modules → source. Every component, relation and step cites a file and line that RepoLens **verified exists at the investigated commit**. Inferred names are labelled as inferred. |
| **Ask RepoLens** | Questions are triaged. Answerable ones are answered from code, pinned to the commit. Testable ones become an **experiment plan** that runs only after your approval, with statistics computed by deterministic Python, never by a model. |
| **/metrics** | Product and agent KPIs (time to first meaningful content, cache hit rate, experiment completion…), each computed only from recorded data and labelled when unmeasured. |

Demo repositories: `AlexIoannides/pyspark-example-project` and `apache/spark`
(Spark), `apache/cassandra` (CLI), `apache/airflow` (hybrid detection),
`pallets/click` (library).

---

## How Muse is used

RepoLens's reasoning runs entirely on **Muse Spark** models, served
through the **Meta Model API**. Agents reason and choose actions; deterministic
tools act; application code validates everything a model returns.

### Three tiers, routed by purpose

All model access goes through one router (`repolens/llm/`). A call site names a
**tier** and a **purpose**, never a model ID. Model IDs come only from the
environment (`MODEL_NANO`, `MODEL_SUPER`, `MODEL_ULTRA`).

| Tier | Model (configured in `.env`) | Used for |
|---|---|---|
| **Nano** | `muse-spark-1.1` | Triaging Ask questions (answer / experiment / out of scope), checking lesson steps, short error explanations, file summaries, log parsing |
| **Super** | `muse-spark-1.2` | The repository-investigator agent loop, architecture synthesis (naming components and cited relations), the plain-language orientation ("What is this?"), naming runtime components, lesson and Mini Lab generation, build diagnosis, grounded answers |
| **Ultra** | `muse-spark-1.3` | Experiment design (`ExperimentPlan`: variable, values, metrics, repeats), hypothesis generation, interpreting **already-measured** results |

### How the output is kept honest

- **Structured JSON only.** Every call names a Pydantic schema. Output is
  validated, retried once on schema failure, and repaired only by deterministic
  code.
- **Reasoning-model aware.** The router reads `content` and handles an empty
  `content`. It records only the *name and size* of a reasoning field, so no
  chain-of-thought is ever persisted or shown.
- **Agents request tools; they never act.** The investigator emits structured
  actions (`{"action": "read_file", "arguments": …, "reason": …}`). The
  application validates each one before a tool runs it, and every tool call is
  an auditable event.
- **Verification after generation.** Muse proposes architecture names,
  relations and flows. RepoLens keeps only what it can verify against the source
  at the investigated commit (symbol present, line in range, relation really in
  the caller's code). Everything else is dropped and counted.
- **No manufactured measurements.** Ultra designs experiments and interprets
  results, but every number comes from real execution (Spark event logs,
  process timing, CLI output) and every statistic from deterministic code.

### Measured usage during development

From RepoLens's own model-call telemetry (`model_calls` table, 5–27 Oct 2026),
recorded by the router on every call:

| Tier | Calls | Successful | Median latency | Prompt tokens | Completion tokens |
|---|---:|---:|---:|---:|---:|
| Super | 1,501 | 1,355 | 2.9 s | 1,884,098 | 1,169,514 |
| Nano | 30 | 30 | 2.1 s | 11,538 | 5,513 |
| Ultra | 27 | 26 | 2.7 s | 79,793 | 39,338 |

By purpose, the largest use was Super for repository investigation (1,353 calls)
and architecture (102), then Super grounded answers (43), Nano question triage
(29) and Ultra experiment design (19) and result interpretation (8). The
`/metrics` page reports these live, along with cost when `MODEL_PRICING` is set.

---

## Meta Model API and sandbox execution

### Meta Model API: Muse inference

- **One OpenAI-compatible endpoint for every tier.** `MUSE_BASE_URL`
  (`https://api.meta.ai/v1/`) serves Nano, Super and Ultra
  through the same client (`repolens/llm/muse.py`). Switching the tier for a
  task is a one-line routing change, not a new integration.
- **It made the cost/quality split practical.**
  - Cheap, fast Nano answers the user immediately (question triage, "is this
    testable?").
  - Super does the long investigation in the background.
  - Ultra is reserved for the few calls where reasoning quality decides the
    outcome (experiment design and interpretation).
- **It enabled the progressive pipeline.** Because each pass is a fast,
  independent API call, RepoLens publishes the deterministic analysis in seconds
  and lets Super passes refine it afterwards. On `apache/spark` the verified
  runtime architecture is on screen at about 31 s, and the Super summary
  follows at about 205 s.
- **It was checked against the live catalog.** `make check` verifies that the
  configured model IDs exist in the Meta Model API's live `/v1/models` catalog
  before they are relied on.

### Docker: local execution

`repolens/sandbox/docker_provider.py` implements RepoLens's `SandboxProvider`
(create, upload, execute, checkpoint, restore, terminate) on local Docker:
`docker commit` is a real checkpoint, each experiment variant restores the
same checkpoint, and images can really be deleted. Experiments and builds run
in containers behind the `ExecutionEnvironment` protocol, so no code path is
bypassed and nothing simulated is substituted.

### Also used

- **Muse web search** (the Meta Responses API's built-in `web_search` tool)
  for version-matched official documentation, restricted to official domains
  such as `spark.apache.org`. It reuses the Meta Model API key.
- **Postgres, Redis and RQ** for persistence, queues and live heartbeats.

---

## Quick start

### Requirements

- [uv](https://docs.astral.sh/uv/) (installs Python 3.11 for you)
- Node.js 20.9+ and npm
- Docker (Postgres and Redis run in Compose; experiments run in containers)
- Credentials, optional:
  - a **Meta Model API** key (`MUSE_API_KEY`, or Meta's `MODEL_API_KEY`
    name), for Muse inference and documentation research.

  Without them RepoLens still runs its deterministic analysis and says plainly
  which model-powered parts are unavailable.

### Setup

```bash
git clone https://github.com/GautamGottipati/RepoLens.git
cd RepoLens

cp .env.example .env      # then add MUSE_API_KEY
make install              # Python 3.11 + backend deps (uv) + web deps (npm)
make up                   # Postgres + Redis (docker compose)
make db-upgrade           # apply database migrations
make check                # optional: verify credentials and model IDs against live services
```

### Run

```bash
make dev                  # API :8000, two workers, web :3000 — Ctrl-C stops everything
open http://localhost:3000
```

Paste a public GitHub URL, for example
`https://github.com/AlexIoannides/pyspark-example-project`. The Overview fills in
within seconds, and the deeper Muse passes continue in the background.

If a previous session left something running, `make stop` clears it.

---

## Running the project

### In the browser

1. **Submit a repository** on the landing page.
2. **Overview** shows facts and the manifest at once, then the summary from
   Muse Super. The activity chip reads "Still learning…" until every part
   is ready.
3. **Experiences**: start one. RepoLens builds or resolves an environment,
   smoke-tests it, and only then marks it ready.
4. **Architecture**: explore it from the overview down to source lines. Click
   any reference to read the exact file at the investigated commit.
5. **Ask RepoLens**: ask *"Why does this job use 200 shuffle partitions?"*.
   Ultra proposes an experiment (variable, values, repeats, estimated runs).
   Approve it, and the variants run and are measured. The explanation cites
   the measurements.

Re-submitting a repository at the same commit is answered from the cache in
about a second, with no clone and no model calls.

### Over HTTP

```bash
curl -X POST localhost:8000/jobs -H 'Content-Type: application/json' \
  -d '{"repo_url":"https://github.com/AlexIoannides/pyspark-example-project"}'

curl -N localhost:8000/jobs/$JOB/events     # live progress (SSE), replays history first
curl    localhost:8000/jobs/$JOB            # status, health (heartbeat), current activity
curl    localhost:8000/jobs/$JOB/artifacts  # every analysis artifact and its state
curl    localhost:8000/jobs/$JOB/manifest   # the RepoManifest
curl    localhost:8000/jobs/$JOB/architecture
```

### Command-line demos

```bash
make run-spark-demo                       # run the repo's own Spark transform in Docker and measure it
make build URL=https://github.com/AlexIoannides/pyspark-example-project   # build + smoke test + checkpoint
make ingest URL=... ARGS="--persist --llm"  # static ingestion only (nothing is executed)
make demo-check                           # preflight: is this machine ready for the demo?
```

See [docs/DEMO.md](docs/DEMO.md) for the full runbook: exact repositories and
commits, cache preparation, a timed script, and recovery steps.

---

## Configuration

All configuration is in `.env`. Copy `.env.example`; it contains no real
credentials.

| Variable | Purpose |
|---|---|
| `MUSE_API_KEY` (or `MODEL_API_KEY`) | Meta Model API key: Muse inference and documentation research |
| `MUSE_BASE_URL` | `https://api.meta.ai/v1/` |
| `MODEL_NANO` / `MODEL_SUPER` / `MODEL_ULTRA` | Muse model IDs. Never hardcoded; validated by `make check` |
| `MODEL_PRICING` | Optional per-model prices, so `/metrics` can estimate cost (otherwise reported as unknown) |
| `DATABASE_URL`, `REDIS_URL` | Local Postgres and Redis (defaults match `docker compose`) |

Secrets are read only from the environment, never logged, and never committed.
`make check-secrets` scans the database, logs and browser artifacts for leaked
credentials.

---

## Architecture

```text
web/      Next.js 16 + React 19 + TypeScript + Tailwind v4 (SSE for progress, xterm.js for terminals)
api/      FastAPI (Python 3.11): sessions, jobs, artifacts, approvals, SSE streams, terminal WebSockets
worker/   RQ workers on three queues (interactive / default / background): investigation, builds, experiments
repolens/  shared package
  agents/       orchestrator + repository-investigator agent (structured actions, validated)
  llm/          the model router: tiers, schemas, retries, telemetry, reasoning-model handling
  ingest/       hardened cloning and static detectors (nothing is executed during ingestion)
  classify/     deterministic rules first; Muse only when signals conflict
  architecture/ static graph, code model, Muse synthesis, source verification
  artifacts/    progressive analysis: per-commit artifacts, cache, dependencies, lazy passes
  experiences/  Spark, CLI, library, live and Mini Lab adapters
  experiments/  plans, variants, measurements, deterministic statistics
  evidence/     code references, measurements, logs and docs behind every explanation
  sandbox/      Docker sandbox provider behind one protocol
  events/       persisted progress events + ephemeral heartbeats
```

The core design choices:

- **Every external system sits behind an interface, with a fake.** That covers
  `LLMProvider`, `ResearchProvider`, `SandboxProvider` and
  `ExecutionEnvironment`, so the entire test suite runs offline.
- **The analysis is published as artifacts.** Facts, manifest, structure,
  runtime, sources, components and summary are each generated, verified,
  persisted and streamed independently, and cached per repository + commit +
  analysis version. One failing pass fails only its own section.
- **Approval gates are enforced in code.** Experiments, expensive services and
  anything that changes learner code wait for an explicit user approval.

Product and architecture definition: [AGENTS.md](AGENTS.md). Screen specs:
[docs/design/](docs/design/). Detailed history with observed runs:
[docs/PROGRESS.md](docs/PROGRESS.md).

---

## Development and tests

```bash
make test          # pytest — fully offline (fakes for every external service)
make lint          # ruff check + format check
make fmt           # apply formatting and safe fixes
make web-lint      # eslint (and `cd web && npx tsc --noEmit` for types)
cd web && npm test # vitest
make e2e           # Playwright, against the real stack
make smoke         # live model checks (skipped without credentials)
```

---

## Project status and limitations

These are stated plainly; [docs/PROGRESS.md](docs/PROGRESS.md) has the detail.

- **Some interaction surfaces have no runnable adapter yet.** RepoLens detects
  web, API, notebook and terminal surfaces, but cannot run them. The
  Experiences screen says so per surface instead of pretending.
- **The Airflow demo shows detection only.** It demonstrates multi-surface
  detection, not a full Airflow environment.
- **Mini Lab is a conceptual simulation.** It is always labelled **SIMULATED**
  and never produces measurements.

---

## License

Licensed under the [Apache License, Version 2.0](LICENSE).

Muse models are used through the Meta Model API under their own
model licenses. The repositories RepoLens analyses keep their own licenses.
RepoLens reads them at a specific commit and does not redistribute them.
