# Backend (tdease-backend) — engineering spec index

> This tree is a POINTER layer, never a second authority. Binding contracts
> live in the main docs system (`docs/README.md` authority order).

## Authority map

| Concern | Authority |
|---|---|
| Development iron rules | `AGENTS.md` (repo root) |
| HTTP surface, Run lifecycle, engine semantics, auth | `docs/spec/WORKFLOW-RUN.md` |
| Error envelope & codes | `docs/spec/FAILURE-CONTRACT.md` |
| Capabilities document | `docs/spec/CAPABILITIES.md` |
| Rust kernel CLI contract | `docs/spec/RUST-MS-CONTRACT.md` |
| Residual engine risks (accepted) | `docs/design/BACKEND-HARDENING.md` |
| What is actually implemented | `docs/STATUS.md` |

Stack: FastAPI + SQLite + SSE, Snakemake 9.23.1 orchestrator (pinned).
Python style: `ruff check` + `ruff format` (rule set pinned in pyproject).

## Pre-Development Checklist

1. Read `AGENTS.md` (binding) and the spec section owning your change.
2. Root suite via `uv run --project tdease-backend pytest tests/` (e2e-first,
   backend-scoped; see STATUS §Backend).

## Quality Check

pytest root suite green (or red recorded in `docs/STATUS.md`) · `ruff check`
+ `ruff format --check` clean · new contract fields change spec + registry +
capability test together (`CAPABILITIES.md` §2).
