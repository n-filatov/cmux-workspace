import fs from "node:fs";
import path from "node:path";
import { repoRoot, branchExists, worktreeRegistered, worktreeAdd } from "../git.ts";
import { readConfig, resolveWorktreesDir, tabCommands, CONFIG_FILE } from "../config.ts";
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
  const tabs = tabCommands(cfg);

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

  let runSetup = true;

  if (isRegistered) {
    console.log(`Reusing existing worktree at ${worktreePath}`);
    runSetup = false;
  } else if (branchExists(branch)) {
    console.log(`Branch '${branch}' exists; checking it out into a new worktree`);
    worktreeAdd(worktreePath, branch, { newBranch: false });
  } else {
    worktreeAdd(worktreePath, branch);
  }

  const cdPart = `cd ${shellQuote(worktreePath)}`;

  if (runSetup && tabs.length === 0 && !cfg) {
    console.log(`No ${CONFIG_FILE} found in ${root}; skipping setup. Run 'cmw init' to generate one.`);
  }

  // Build per-tab command strings. Reused workspaces skip per-tab setup
  // commands and just cd into the worktree in a single pane.
  const effectiveTabs = runSetup && tabs.length > 0 ? tabs : [[]];
  const tabCmds: string[] = effectiveTabs.map((cmds) => {
    return [cdPart, ...cmds].join(" && ");
  });

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

  await rpcOrThrow("workspace.select", { workspace_id: workspaceId });

  const surfaces = await rpcOrThrow("surface.list", { workspace_id: workspaceId });
  const firstId: string | undefined = surfaces.surfaces?.[0]?.id;
  if (!firstId) {
    throw new Error("Workspace has no surface");
  }

  await sendCommand(firstId, tabCmds[0]);

  for (let i = 1; i < tabCmds.length; i++) {
    const created = await rpcOrThrow("surface.create", { workspace_id: workspaceId });
    const newId: string | undefined = created?.surface_id;
    if (!newId) {
      throw new Error(`surface.create did not return surface_id (tab ${i + 1})`);
    }
    await sendCommand(newId, tabCmds[i]);
  }

  console.log(`cmux workspace '${branch}' ready at ${worktreePath}`);
}

async function sendCommand(surfaceId: string, cmd: string): Promise<void> {
  await rpcOrThrow("surface.send_text", { surface_id: surfaceId, text: cmd });
  await rpcOrThrow("surface.send_key", { surface_id: surfaceId, key: "enter" });
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}
