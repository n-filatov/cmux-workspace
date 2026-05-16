import { execSync, spawnSync } from "node:child_process";

export function repoRoot(): string {
  try {
    return execSync("git rev-parse --show-toplevel", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    throw new Error("Not inside a git repository");
  }
}

export function worktreeAdd(path: string, branch: string): void {
  const res = spawnSync("git", ["worktree", "add", path, "-b", branch], {
    stdio: "inherit",
  });
  if (res.status !== 0) {
    throw new Error(`git worktree add failed`);
  }
}

export function worktreeRemoveForce(path: string): void {
  const res = spawnSync("git", ["worktree", "remove", "--force", path], {
    stdio: "inherit",
  });
  if (res.status !== 0) {
    throw new Error(`git worktree remove failed`);
  }
}

export function trackedDirty(path: string): string[] {
  const out = execSync(`git -C ${JSON.stringify(path)} status --porcelain`, {
    encoding: "utf8",
  });
  return out
    .split("\n")
    .filter((line) => line.length > 0 && !line.startsWith("??"));
}
