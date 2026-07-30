# Claude project instructions

Read [AGENTS.md](AGENTS.md) completely before making changes. It is the canonical agent handoff for this repository.

Also read:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for state and file flow.
- [docs/DATA_RULES.md](docs/DATA_RULES.md) for parser behavior.
- [docs/ROADMAP.md](docs/ROADMAP.md) for known limitations.

Important: never commit customer CSV files, never mutate `AreaSuite`, and run `node --test` after parser or export changes.

