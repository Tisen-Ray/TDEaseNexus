# TDEaseNexus · TD通

AI-first top-down mass spectrometry (TD-MS) analysis desktop workbench. A researcher
states an analysis goal; the built-in agent selects templates and managed capabilities,
runs the native workflow (MSConvert → TopFD → TopPIC), supervises execution, and helps
inspect results — with every intermediate result stored, re-readable, and cross-checkable.

Calm, precise, forgiving: quiet during routine work, explicit when decisions or failures
need attention. It refuses to be a node-editor, a parameter-wizard maze, a card-grid
dashboard, or opaque AI.

**Status: `0.11.0-beta`** ([changelog](CHANGELOG.md)) · License: GPL-3.0-or-later

## Download

Prebuilt installers for v0.11.0-beta are published at
[TDEaseNexus-Releases](https://github.com/Tisen-Ray/TDEaseNexus-Releases/releases):

- **Windows** — NSIS installer (`.exe`), per-user install.
- **Linux** — AppImage (`.AppImage` + `.sha256` checksum).

The installer bundles the Python runtime and fetches third-party workflow binaries
(TopPIC Suite, ProteoWizard, Informed-Proteomics) on demand. It ships **no model
provider API key** — see Getting started below.

## Getting started

1. Download the installer for your platform from the
   [releases page](https://github.com/Tisen-Ray/TDEaseNexus-Releases/releases)
   (Windows: run the installer; Linux: `chmod +x` the AppImage and run it).
2. Launch TDEaseNexus and open **Settings → model providers** to configure your
   own provider endpoint and API key. Keys are stored encrypted by the desktop
   (no plaintext fallback); nothing is bundled or sent anywhere but the endpoint
   you configure.
3. State an analysis goal on the Agent page — the agent assembles the workflow,
   asks before risky steps, and keeps every intermediate result inspectable.

## Building from source

Prerequisites: Node `>=24.12 <25` + pnpm 10, Python 3.11+ with
[uv](https://docs.astral.sh/uv/), Rust >= 1.97.

```bash
git clone --recurse-submodules https://github.com/Tisen-Ray/TDEaseNexus.git
cd TDEaseNexus

# Frontend (TDEase-FrontEnd/)
pnpm install
pnpm dev            # vite dev server
pnpm build          # typecheck + gates + production build
pnpm test:run       # vitest
# e2e only: pnpm exec playwright install

# Backend (tdease-backend/)
uv sync

# Root contract/E2E suite (repo root; runs under the backend project env)
uv run --project tdease-backend pytest tests/

# Rust kernel (tdease-ai-capability/rust/)
cargo test

# one-time: enable the zero-dependency pre-commit gate
git config core.hooksPath githooks
```

Release artifacts are built by `scripts/release/` (`build-desktop.ps1` for the
Windows NSIS installer, `build-desktop-linux.sh` for the AppImage).

## Repository layout

Three independent products, one dependency direction:

```text
TDEaseNexus/
├─ TDEase-FrontEnd/        Desktop UI, Electron host, Agent experience (this repo)
├─ tdease-backend/         Submodule: Python/FastAPI service, Snakemake engine
├─ tdease-ai-capability/   Submodule: Rust scientific kernel + domain Skills + prompts
├─ data/                   Local development runtime data (simulated client install)
├─ docs/                   Product contracts (spec/), designs, current status
└─ tests/                  Root contract/E2E suite (backend + skills)
```

```text
Desktop -> Backend -> Scientific System
Desktop ------------> Scientific System
```

- Desktop owns UX, sessions, permissions, visualization, process supervision.
- Backend owns Run lifecycle, execution, storage, synchronization, server policy.
- Scientific System owns Skills, scientific assets, and Rust computation
  (`tdeasenexus-toolbox`).

The two submodules are required; a plain `git clone` without
`--recurse-submodules` will not build. Run `git submodule update --init
--recursive` if you already cloned.

## Documentation

Authoritative order lives in [docs/README.md](docs/README.md): iron rules
([AGENTS.md](AGENTS.md)) → accepted contracts (`docs/spec/`) → designs (`docs/design/`)
→ [docs/STATUS.md](docs/STATUS.md) (what is implemented today). Agent tool surface:
`docs/spec/AGENT-CONTRACT.md`; Run lifecycle: `docs/spec/WORKFLOW-RUN.md`; Rust CLI
contract: `docs/spec/RUST-MS-CONTRACT.md`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: development happens on `main`,
end-to-end evidence beats unit tests, and documentation is written only when asked for.

## Citing

If you use TDEaseNexus, please cite this repository (see
[CITATION.cff](CITATION.cff)) and the companion manuscript. Versioned software DOI
(Zenodo–GitHub integration) and data-repository DOIs (frozen reproduction package and
certified agent-session trajectories) will be added here upon deposit.

## License

Licensed under the [GNU General Public License v3.0](LICENSE) or later
(GPL-3.0-or-later), matching all three repositories.

## 中文说明

TDEaseNexus · TD通 是一个 AI 优先的自上而下质谱（TD-MS）分析桌面工作台：研究者陈述
分析目标，内置智能体选择模板与受管能力，驱动原生流程（MSConvert → TopFD → TopPIC），
监督执行，并协助检查结果——所有中间结果均可存储、回读与交叉验证。

- 下载安装包（Windows 安装程序 / Linux AppImage，当前版本 `0.11.0-beta`）：
  [Releases](https://github.com/Tisen-Ray/TDEaseNexus-Releases/releases)
- 首次使用：安装后在 **设置 → 模型服务** 中配置你自己的服务商接口与 API 密钥
  （应用不内置任何密钥，密钥在本机加密存储）。
- 许可证：GPL-3.0-or-later。文档目前为英文；[CHANGELOG](CHANGELOG.md) 与
  [docs/STATUS.md](docs/STATUS.md) 记录当前实现状态。
