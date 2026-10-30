<!-- BEGIN swamp managed section - DO NOT EDIT -->
# Project

This repository is managed with [swamp](https://github.com/swamp-club/swamp).

## Rules

1. **Search before you build.** When automating AWS, APIs, or any external service: (a) search community extensions with `swamp extension search <query>` — prefer `@swamp/*` official extensions first, (b) search local/installed types with `swamp behavior type search <query>`, (c) if a community extension exists, install it with `swamp extension pull <package>` instead of building from scratch, (d) extend an existing type if it covers the domain but lacks the method you need, (e) only create a custom extension behavior in `extensions/models/` as a last resort. Use the `swamp` skill for guidance. The `command/shell` behavior is ONLY for ad-hoc one-off shell commands, NEVER for wrapping CLI tools or building integrations.
2. **Extend, don't be clever.** When a behavior covers the domain but lacks the method you need, extend it with `export const extension` — don't bypass it with shell scripts, CLI tools, or multi-step hacks. One method, one purpose. Use `swamp behavior type describe <type> --json` to check available methods.
3. **Use the data model.** Once data exists in a behavior (via `lookup`, `start`, `sync`, etc.), reference it with CEL expressions. Don't re-fetch data that's already available.
4. **CEL expressions everywhere.** Wire behaviors together with CEL expressions. Always prefer `data.latest("<name>", "<dataName>").attributes.<field>` over the deprecated `model.<name>.resource.<spec>.<instance>.attributes.<field>` pattern.
5. **Verify before destructive operations.** Always `swamp behavior get <name> --json` and verify resource IDs before running delete/stop/destroy methods.
6. **Prefer fan-out methods over loops.** When operating on multiple targets, use a single method that handles all targets internally (factory pattern) rather than looping N separate `swamp behavior run` calls against the same behavior. Multiple parallel calls against the same behavior contend on the per-behavior lock, causing timeouts. A single fan-out method acquires the lock once and produces all outputs in one execution. Check `swamp behavior type describe` for methods that accept filters or produce multiple outputs.
7. **Extension npm deps are bundled; pin them.** Swamp's bundler inlines all npm packages (except zod) into extension bundles at bundle time. When the extension has a `deno.json`, the `deno.lock` beside it decides which versions are bundled; otherwise the registry's current release does. Always pin explicit versions in `npm:` and `jsr:` import specifiers (e.g., `npm:lodash-es@4.17.21`) — `swamp extension push` warns on unpinned and range specifiers.
8. **Reports for reusable data pipelines.** When the task involves building a repeatable pipeline to transform, aggregate, or analyze behavior output (security reports, cost analysis, compliance checks, summaries), create a report extension. Use the `swamp` skill for guidance.
9. **"Workflow" means a swamp workflow.** In this repository the word "workflow" (and "create/run/execute/validate/debug workflow", "automate", "orchestrate", "automated/nightly job") refers to a swamp workflow — a declarative YAML DAG of behavior-method steps authored via `swamp workflow create`. Load and follow the `swamp` skill for these requests. Do NOT interpret these as a request to build an agent task list, spin up worktrees, or schedule a cron/remote agent. Only use those orchestration mechanisms when the user explicitly names one (e.g. "task list", "subagent", "worktree", "cron", "remote agent") or explicitly asks you to do the work yourself step by step rather than author a swamp workflow.
10. **Use swamp, don't bypass it.** Always work through swamp commands — don't go around them with raw shell tools. Use `swamp data query` to find data, not `grep`/`find` on `.swamp/` files. Use behavior methods to interact with resources, not `curl`/`aws`/`gcloud`/`kubectl` when a behavior type already wraps that API — check with `swamp behavior type search`. Use `swamp help` for CLI discovery, not guesswork. Composing with swamp output is fine (e.g. piping `--json` through `jq`) — the anti-pattern is bypassing swamp entirely.
11. **Inspect reports after failures.** When a behavior method or workflow run fails, inspect its generated reports before retrying or changing definitions. Reports run even on failure and capture structured diagnostics — error messages, execution status, arguments, and data output pointers. Use `swamp report get @swamp/method-summary --model <model> --json` for method failures or `swamp report get @swamp/workflow-summary --workflow <workflow> --json` for workflow failures. Run `swamp help report get` to confirm current retrieval syntax.

## Skills

**IMPORTANT:** Always load swamp skills, even when in plan mode. The skills provide
essential context for working with this repository.

- `swamp` - Swamp CLI — behaviors, workflows, data, vaults, extensions, publishing, repos, reports, issues, and troubleshooting
- `swamp-getting-started` - Interactive onboarding for new swamp users

## Getting Started

If you were asked to read a task brief under `tasks/` (a file whose first
line is `<!-- swamp start brief v1 -->`), read that brief, then invoke the
`swamp-getting-started` skill and follow it from its brief entry point.

If the user is new to swamp or asks to get started, or a swamp command you
run shows this repository has no behaviors yet, invoke the
`swamp-getting-started` skill. It checks for existing behaviors itself and walks
new users through an interactive onboarding tutorial.

Otherwise, use the `swamp` skill to work with swamp behaviors.

## Commands

Use `swamp --help` to see available commands. For a machine-readable JSON
schema of the CLI (commands, options, arguments) intended for agent
consumption, run `swamp help [<command>...]` — e.g. `swamp help` returns
the full tree, and `swamp help behavior run` scopes to a subtree.

Behaviors (formerly models) are managed with `swamp behavior` — e.g.
`swamp behavior run <name> <method>` (or
`swamp behavior run @<type> <method> <name>` to run against a type
directly). Every `swamp model …` spelling remains supported.
<!-- END swamp managed section -->

## Puddle repo

This repo is a puddle made from `puddle-works/puddle-template` ([ADR-004][adr]).
It holds one puddle: one extension with one bounded purpose.

- `make test` runs every test in `extensions/models/`. One of them checks that
  each workflow is a `workflow-*.yaml` file with its own UUID `id`; swamp skips
  any other file without a word.
- `make contracts-check` and `make guardrails-check` run the shared checks from
  puddle-tooling. Every workflow in `workflows/` needs `maxReruns` and
  `maxWallClock` tags, and a workflow that reads another model's data with
  `data.latest` needs an entry in `contracts.ts`.
- `make publish VISIBILITY=private DRY_RUN=1` runs the publish dry run. Never
  push with `--yes`; `VISIBILITY` must equal `visibility:` in `manifest.yaml`.
- Review reports live in `swamp-extension-review/` and are committed with the
  version they review.
- `example.ts`, its test and `workflows/workflow-example.yaml` are
  placeholders. Replace them; do not extend them.

[adr]: https://github.com/puddle-works/puddleworks-apps/blob/main/docs/adr/ADR-004-one-repo-per-puddle.md

<!-- BEGIN puddleworks-factory app section -->
# swamp-extension-checker

Deterministic check: Does this repository have a LICENSE file?. Built by puddleworks-factory from the app spec `swamp-extension-checker`;
the specification below was agreed before it was handed over.

Spec: [where it was agreed](http://127.0.0.1:3002/requests/afb8c437-bf4f-4fad-be6b-5204a34921e3), version 1, hash `6e074ac7eedb53b0c5c3051df877f27aba0134075243a04560c2a9624429eb73`.

## Bounded purpose

Say whether a git repository has a licence file at its root, which file it is, and the licence's SPDX name when GitHub reports one.

## Inputs (the run form)

- `repo` (string, empty) — A GitHub repository as owner/name or a github.com URL. Empty means check path instead.
- `path` (string, `"."`) — A local directory; the git repository it is in is checked at its working-tree root. Used when repo is empty.

## Settings (set once per model instance)

None.

## Output

One record: whether the repository has a licence file at its root, the file's path (or none), the licence's SPDX name when GitHub reports one, and where it was checked (the local working tree or the GitHub default branch). Outside a git repository it says so instead.

## Out of scope

- Judging whether the licence is suitable, valid or compatible with dependencies
- Licence files below the root, licence headers in source files and package-manifest licence fields
- Adding or changing a licence file
- The old Jev router registry (spikes/branch-protection-api/api/registry.ts in puddle-works/swamp-for-everything): puddlerouter's recipes now play that role

Anything on this list, or anything beyond the purpose above, needs a new
spec. Do not add it here, and do not add permissions or secrets the
settings above do not name.

## Finishing the draft

1. Replace the `run` stub in `extensions/models/swamp_extension_checker.ts` with the
   real behaviour. Keep the argument names: the workflow and the run form
   depend on them.
2. Give `ResultSchema.items` the shape of the output above, and add tests for
   the behaviour to `extensions/models/swamp_extension_checker_test.ts`. Leave the
   generated tests as they are: they stub `run`, so they keep passing. Tests
   of the behaviour call `run` directly with working settings.
3. If the tests need permissions (`--allow-read`, `--allow-net`, …), add the
   same flags to the "Test it" command in `README.md`, to the `test` target
   in the `Makefile`, and to the test commands in
   `.github/workflows/ci.yml` if the repo has one.
4. `deno check` and `deno test` must pass before review.
<!-- END puddleworks-factory app section -->
