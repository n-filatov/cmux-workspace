import fs from "node:fs";
import path from "node:path";
import { repoRoot, branchExists, worktreeRegistered } from "../git.ts";
import { readConfig, resolveWorktreesDir, setupCommands, CONFIG_FILE } from "../config.ts";
import { rpcOrThrow } from "../cmux.ts";
import { confirmYesDefault } from "../prompt.ts";

type CmuxWorkspace = { id?: string; title?: string };

export async function newWorkspace(branch: string): Promise<void> {
  if (!branch) {
    throw new Error("Usage: cmw new <branch>");
  }

  const root = repoRoot();
  const repoName = path.basename(root);

  const cfg = readConfig(root);
  const setup = setupCommands(cfg);

  const worktreesDir = resolveWorktreesDir(root, cfg);
  fs.mkdirSync(worktreesDir, { recursive: true });
  const worktreePath = path.join(worktreesDir, `${repoName}-${branch}`);

  // Decide which git command(s) to run based on existing state.
  const dirExists = fs.existsSync(worktreePath);
  const isRegistered = dirExists && worktreeRegistered(worktreePath);

  if (dirExists && !isRegistered) {
    throw new Error(
      `${worktreePath} exists but is not a registered git worktree. Remove it or pick a different branch name.`,
    );
  }

  const gitParts: string[] = [];
  let runSetup = true;

  if (isRegistered) {
    console.log(`Reusing existing worktree at ${worktreePath}`);
    runSetup = false;
  } else if (branchExists(branch)) {
    console.log(`Branch '${branch}' exists; checking it out into a new worktree`);
    gitParts.push(`git worktree add ${shellQuote(worktreePath)} ${shellQuote(branch)}`);
  } else {
    gitParts.push(`git worktree add ${shellQuote(worktreePath)} -b ${shellQuote(branch)}`);
  }

  gitParts.push(`cd ${shellQuote(worktreePath)}`);

  const parts = runSetup ? [...gitParts, ...setup] : gitParts;
  if (runSetup && setup.length === 0 && !cfg) {
    console.log(`No ${CONFIG_FILE} found in ${root}; skipping setup. Run 'cmw init' to generate one.`);
  }
  const cmd = parts.join(" && ");

  // Find or create the cmux workspace.
  const list = await rpcOrThrow("workspace.list", {});
  const existing: CmuxWorkspace | undefined = list.workspaces?.find(
    (w: CmuxWorkspace) => w.title === branch,
  );

  let workspaceId: string;
  if (existing?.id) {
    const reuse = await confirmYesDefault(
      `cmux workspace '${branch}' already exists. Reuse it?`,
    );
    if (!reuse) {
      console.log("Aborted.");
      return;
    }
    workspaceId = existing.id;
  } else {
    const created = await rpcOrThrow("workspace.create", {});
    workspaceId = created.workspace_id;
    await rpcOrThrow("workspace.rename", { workspace_id: workspaceId, title: branch });
  }

  const surfaces = await rpcOrThrow("surface.list", { workspace_id: workspaceId });
  const surfaceId: string | undefined = surfaces.surfaces?.[0]?.id;
  if (!surfaceId) {
    throw new Error("Workspace has no surface");
  }

  await rpcOrThrow("surface.send_text", { surface_id: surfaceId, text: cmd });
  await rpcOrThrow("surface.send_key", { surface_id: surfaceId, key: "enter" });
  await rpcOrThrow("workspace.select", { workspace_id: workspaceId });

  console.log(`cmux workspace '${branch}' ready at ${worktreePath}`);
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}
