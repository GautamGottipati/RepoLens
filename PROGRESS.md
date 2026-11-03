# museProject — Migration Progress

Source: `/Users/gautamgottipati/Documents/RepoLab` (RepoLab)
Destination: `/Users/gautamgottipati/Documents/museProject` (this folder)
Goal: same project, same behavior, with Nebius inference models replaced by
Muse (Meta Model API / Muse Spark) models and Tavily replaced by the Muse
web-search substitute. Parity is proven by the repo's own offline test suite
plus service-check SKIP semantics.

## Replacement decisions

- LLM inference: Nebius Token Factory (`https://api.tokenfactory.nebius.com/v1/`,
  `NEBIUS_API_KEY`) → Meta Model API (`https://api.meta.ai/v1/`, `MUSE_API_KEY`
  with `MODEL_API_KEY` accepted as an alias — that is Meta's official key name).
  The Meta API is OpenAI-compatible, so the provider keeps the `openai` SDK.
- Model tiers keep their names; only the IDs change:
  - `MODEL_NANO`: `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` → `muse-spark-1.1`
  - `MODEL_SUPER`: `nvidia/nemotron-3-super-120b-a12b` → `muse-spark-1.2`
  - `MODEL_ULTRA`: `nvidia/Nemotron-3-Ultra-550b-a55b` → `muse-spark-1.3`
- Research: Tavily (`TAVILY_API_KEY`, `tavily-python`) → `MuseResearchProvider`
  built on the Meta Responses API's built-in `web_search` tool, reusing
  `MUSE_API_KEY`. No separate research key. Same `ResearchProvider` protocol,
  same `None`-tolerant call sites, same 20s deadline.
- `tavily-python` removed from dependencies. `openai` stays (Muse provider uses
  it). `httpx` (already a dependency) drives the Responses call. No new deps.
- Nebius Sandboxes (ConTree execution, `NEBIUS_API_KEY` + `NEBIUS_PROJECT_ID`)
  are execution, not models, so they stay as-is. `NEBIUS_API_KEY` is now
  sandbox-only. Nebius cloud deploy scripts/docs stay as-is.
- UI/prose: user-visible "Nemotron …" becomes "Muse …" (tiers unchanged).

## File work list

- [x] Copy tree (excluding secrets, caches, venv, node_modules)
- [x] `repolab/llm/muse.py` (new) / delete `repolab/llm/nebius.py`
- [x] `repolab/research/muse.py` (new) / delete `repolab/research/tavily.py`
- [x] `repolab/config.py` (muse key/base, drop tavily key, sandbox keeps nebius)
- [x] `repolab/llm/__init__.py`, `repolab/capability.py`, `repolab/failures.py`
- [x] `repolab/llm/router.py`, `repolab/llm/schema.py`, `repolab/llm/tiers.py`
- [x] `repolab/architecture/*`, `repolab/experiments/agent.py` (prose)
- [x] `api/routes/lessons.py`, `worker/*_tasks.py`
- [x] `scripts/check_services.py`, `check_secrets.py`, `demo_check.py`,
      `demo_prepare.py`, `run_experiment.py`, `ingest_repo.py`,
      `check_deployment.sh`
- [x] `pyproject.toml` (tavily dropped), `.env.example` rewritten for Muse;
      `Makefile`/`Dockerfile`/`docker-compose*.yml` needed no change
      (only sandbox/deploy Nebius refs, kept)
- [x] `tests/` updates (config, secrets, failure modes, capability report,
      llm factory, build cli, live markers) + new `tests/test_muse_research.py`
- [x] `web/` display strings (Nemotron → Muse)
- [x] `README.md`, `AGENTS.md`, deploy/demo docs; `docs/PROGRESS.md` kept as
      marked history

## Test log

- [x] Baseline: source offline suite (`/tmp/repolab-baseline`, writable copy,
      source `.venv`, `pytest -q`): everything passes except 1 FAILED +
      12 ERRORs, all environmental under this sandbox:
  - `test_docker_environment.py::TestWorkdirHandling::test_a_directory_is_created_when_not_supplied`
    — `Path.home() / ".repolab/work"` mkdir denied (HOME outside writable roots)
  - 12x `test_api_runtimes.py` setup ERRORs — `socket.bind(127.0.0.1)` denied
  - Parity target for the new tree: identical-or-better under the same sandbox.
- [x] New: `ruff check .` → All checks passed; `ruff format --check .` →
      352 files already formatted (3 touched files reformatted once).
- [x] New: offline `pytest -q` → the SAME 1 FAILED + 12 ERRORs as baseline
      (same tests, same sandbox causes), everything else passing — including
      the new `tests/test_muse_research.py` (13 tests) and all updated
      config/secrets/failure-mode/capability/factory tests.
      Focused run (`test_muse_research`, `test_config`, `test_secrets`,
      `test_llm_factory`, `test_capability_report`, `test_failure_modes`):
      97 passed, exit 0.
- [x] New: `HOME=/tmp/fakehome` run of `TestWorkdirHandling` → 3 passed,
      proving the 1 FAILED is purely the sandbox HOME denial, not a regression.
- [x] New: `scripts/check_services.py` without keys → inference rows SKIP on
      `MUSE_API_KEY not set`, sandbox rows SKIP on `NEBIUS_API_KEY not set`,
      `Muse official search` SKIP on `MUSE_API_KEY not set`. (Postgres/Redis
      FAIL: loopback sockets denied by the sandbox, same as source here.)
- [x] New: web `vitest run` → 14 files / 139 tests passed; `tsc --noEmit` →
      clean after `npm run typegen` (the 4 first-run errors were missing
      generated `.next/types`, excluded from the copy by design); `eslint` →
      clean.
- [ ] Not run (need Docker + network + browsers, blocked by this sandbox):
      Playwright e2e, `make smoke` (live models), `test-docker` / `slow` /
      `network` markers. Same limitation applies to the source tree here.

## Full Nebius removal (2026-11-02)

- Deleted: `repolab/sandbox/nebius.py`, `scripts/deploy/bootstrap_nebius.sh`,
  `scripts/deploy/bootstrap_vm.sh`, `docs/DEPLOY_NEBIUS.md`; dropped
  `contree-sdk` from `pyproject.toml` (+ `uv.lock` regen) and the
  `NEBIUS_API_KEY` / `NEBIUS_PROJECT_ID` settings.
- Sandbox is Docker-only now: `scripts/build_repo.py --provider auto|docker|fake`
  (auto = Docker when a daemon answers, else fake), `check_services.py`
  sandbox rows probe `DockerSandboxProvider` or SKIP on "Docker daemon not
  available". `check_secrets.py` watches `muse_api_key` only.
- Deploy is GCP-only: `common.sh` firewall keeps the `gcp` branch (unknown
  providers refused), `check_deployment.sh` drops the Nebius project row and
  metadata branch; README, AGENTS.md, DEPLOY_GCP/OPERATIONS, BACKLOG,
  Makefile, `.env.example`, CI comment, and compose header rewritten
  Docker/GCP-only.
- Tests: Nebius sandbox-protocol tests → Docker equivalents;
  `test_build_cli` docker-daemon failure test (daemon-free via empty `PATH`);
  config/secrets tests Muse-only; deploy tests GCP-only with `nebius` pinned
  as a refused provider. Intentionally kept strings: the `nebius`-refused
  pin and the `tvly-` stale-secret detector in `test_secrets.py`.
- History kept verbatim: `docs/PROGRESS.md` (marked pre-migration record).
- Verified: `ruff check` + `ruff format --check` clean; full offline `pytest`
  failure set identical to baseline (same 1 FAILED + 12 sandbox-environmental
  ERRORs); focused deploy/config/secrets/sandbox/build tests green.

## Spec rename + docs scrub (2026-11-02)

- Renamed root `CLAUDE.md` → `AGENTS.md` (content unchanged); updated all
  `CLAUDE.md` cross-references in code comments, tests, web sources, README,
  design docs, BACKLOG, and the ruff config comment (~60 sites).
  `docs/PROGRESS.md` history keeps its original wording (verbatim record).
  `web/CLAUDE.md` is a separate web-only file and was left alone.
- Markdown vendor scrub: no Tavily, Nemotron, Token Factory, or NVIDIA-model
  references remain in any active `.md` file. Remaining `Nebius` mentions are
  exclusively the optional Sandbox execution backend (`repolab/sandbox/nebius.py`,
  `--provider nebius`, still in code) and Nebius-cloud hosting
  (`docs/DEPLOY_NEBIUS.md`, deploy scripts, still in repo) — plus this log
  and the marked `docs/PROGRESS.md` history. Full sandbox/cloud removal from
  code is a separate, larger change if wanted.
- Verified after rename: `ruff check` + `ruff format --check` clean; full
  offline `pytest` failure set byte-identical to the pre-rename run (same 1
  FAILED + 12 sandbox-environmental ERRORs).

## Setup note (2026-11-02)

- No `.env` existed, so the app had no key even though one had been pasted
  into `.env.example` (which the app never reads — settings load `.env` only).
- Created `.env` from the template (carrying the already-pasted Muse key into
  its correct home), restored the placeholder in `.env.example`, and commented
  out the unused optional `NEBIUS_*` sandbox lines in `.env` so the sandbox
  probes SKIP instead of attempting with placeholder text.
- Verified: `muse_key=True`, tiers resolve to the three `muse-spark-*` IDs,
  and `test_the_env_template_holds_no_real_credential` passes.
- [ ] New: `ruff check` + `ruff format --check`
- [ ] New: offline `pytest` (default deselected markers)
- [ ] New: `scripts/check_services.py` SKIP semantics without keys
- [ ] New: web `vitest run` (if time permits; web logic unchanged)
