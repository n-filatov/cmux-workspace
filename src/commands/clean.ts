import fs from "node:fs";
import path from "node:path";
import { repoRoot, trackedDirty, worktreeRemoveForce } from "../git.ts";
import { rpcOrThrow } from "../cmux.ts";

export async function clean(branch: string): Promise<void> {
  if (!branch) {
    throw new Error("Usage: cmw clean <branch>");
  }

  const root = repoRoot();
  const repoName = path.basename(root);
  const worktreePath = path.join(path.dirname(root), `${repoName}-${branch}`);

  if (fs.existsSync(worktreePath)) {
    const dirty = trackedDirty(worktreePath);
    if (dirty.length > 0) {
      console.error(`cmw clean: aborted — ${worktreePath} has uncommitted changes:`);
      for (const line of dirty) console.error(line);
      process.exit(1);
    }
    worktreeRemoveForce(worktreePath);
  } else {
    console.log(`cmw clean: worktree ${worktreePath} not found, skipping`);
  }

  const list = await rpcOrThrow("workspace.list", {});
  const match = list.workspaces?.find((w: { title?: string; id?: string }) => w.title === branch);
  if (!match?.id) {
    console.log(`cmw clean: no cmux workspace named '${branch}'`);
    return;
  }

  await rpcOrThrow("workspace.close", { workspace_id: match.id });
  console.log(`cmw clean: closed cmux workspace '${branch}'`);
}
