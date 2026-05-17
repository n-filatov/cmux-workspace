# cmux-workspace (`cmw`)

CLI for spawning [cmux](https://cmux.com) workspaces with a fresh git worktree and a per-repo setup pipeline.

## Install

```sh
bun install -g github:n-filatov/cmux-workspace
```

Requires bun ≥ 1.0 and macOS (cmux only runs on macOS).

## Setup a repo

From the repo root:

```sh
cmw init
```

This creates `.cmux-workspace.json` with setup commands inferred from the project (package manager from lockfile, `setup` script from `package.json`). Commit the file.

Example output:

```json
{
  "setup": ["pnpm install", "pnpm run setup"]
}
```

### Config schema

| Field          | Type                  | Default                       | Notes                                                                 |
| -------------- | --------------------- | ----------------------------- | --------------------------------------------------------------------- |
| `setup`        | `string \| string[]`  | none                          | Single-pane setup. Joined with ` && ` when array. Skipped if absent. Ignored when `tabs` is set. |
| `tabs`         | `string[][]`          | none                          | Opens one cmux terminal tab per entry (stacked in the same pane, not split). Each inner array is the command pipeline for that tab, joined with ` && `. |
| `worktreesDir` | `string`              | repo's parent directory       | Where new worktrees are placed. Supports `~`, absolute, or relative-to-repo paths. Created if missing. Final worktree path is `<worktreesDir>/<repo>-<branch>`. |

Example with a dedicated worktrees folder:

```json
{
  "worktreesDir": "~/worktrees",
  "setup": ["pnpm install", "pnpm run setup"]
}
```

Example with two panes — one runs setup, the other launches Claude:

```json
{
  "tabs": [
    ["pnpm install", "pnpm run setup"],
    ["claude"]
  ]
}
```

## Spawn a workspace

```sh
cmw new my-feature
```

Behavior:

1. Creates a new cmux workspace named `my-feature`.
2. Adds a git worktree at `../<repo>-my-feature` on a new branch `my-feature`.
3. Runs the `setup` commands from `.cmux-workspace.json` in the new worktree.
4. Selects the new cmux workspace so you see it immediately.

If `.cmux-workspace.json` is missing, only the worktree is created (no setup).

## Tear down

```sh
cmw clean my-feature
```

Removes the worktree and closes the cmux workspace. The git branch is preserved.

Aborts if there are uncommitted modifications to tracked files. Untracked files (e.g. `node_modules`) are removed.
