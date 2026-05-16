import path from "node:path";
import { repoRoot } from "../git.ts";
import { readConfig, setupCommands, CONFIG_FILE } from "../config.ts";
import { rpcOrThrow } from "../cmux.ts";

export async function newWorkspace(branch: string): Promise<void> {
  if (!branch) {
    throw new Error("Usage: cmw new <branch>");
  }

  const root = repoRoot();
  const repoName = path.basename(root);
  const worktreePath = path.join(path.dirname(root), `${repoName}-${branch}`);

  const cfg = readConfig(root);
  if (!cfg) {
    console.log(`No ${CONFIG_FILE} found in ${root}; skipping setup. Run 'cmw init' to generate one.`);
  }
  const setup = setupCommands(cfg);

  // 1. Create workspace
  const created = await rpcOrThrow("workspace.create", {});
  const workspaceId: string = created.workspace_id;

  // 2. Rename to branch name
  await rpcOrThrow("workspace.rename", { workspace_id: workspaceId, title: branch });

  // 3. Find surface
  const surfaces = await rpcOrThrow("surface.list", { workspace_id: workspaceId });
  const surfaceId: string | undefined = surfaces.surfaces?.[0]?.id;
  if (!surfaceId) {
    throw new Error("New workspace has no surface");
  }

  // 4. Queue command + enter, then select to boot shell
  const parts = [
    `git worktree add ${shellQuote(worktreePath)} -b ${shellQuote(branch)}`,
    `cd ${shellQuote(worktreePath)}`,
    ...setup,
  ];
  const cmd = parts.join(" && ");

  await rpcOrThrow("surface.send_text", { surface_id: surfaceId, text: cmd });
  await rpcOrThrow("surface.send_key", { surface_id: surfaceId, key: "enter" });
  await rpcOrThrow("workspace.select", { workspace_id: workspaceId });

  console.log(`cmux workspace '${branch}' created; worktree at ${worktreePath}`);
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}
