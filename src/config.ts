import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const CONFIG_FILE = ".cmux-workspace.json";

export type Config = {
  setup?: string | string[];
  tabs?: string[][];
  worktreesDir?: string;
};

export function resolveWorktreesDir(repoRoot: string, cfg: Config | null): string {
  const raw = cfg?.worktreesDir;
  if (!raw) return path.dirname(repoRoot);
  const expanded = raw.startsWith("~/") || raw === "~"
    ? path.join(os.homedir(), raw.slice(1))
    : raw;
  return path.isAbsolute(expanded) ? expanded : path.resolve(repoRoot, expanded);
}

export function configPath(repoRoot: string): string {
  return path.join(repoRoot, CONFIG_FILE);
}

export function readConfig(repoRoot: string): Config | null {
  const file = configPath(repoRoot);
  if (!fs.existsSync(file)) return null;

  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch (e) {
    throw new Error(`Failed to read ${CONFIG_FILE}: ${(e as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`${CONFIG_FILE} is not valid JSON: ${(e as Error).message}`);
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`${CONFIG_FILE} must be a JSON object`);
  }

  const obj = parsed as Record<string, unknown>;
  const setup = obj.setup;
  if (
    setup !== undefined &&
    typeof setup !== "string" &&
    !(Array.isArray(setup) && setup.every((s) => typeof s === "string"))
  ) {
    throw new Error(`${CONFIG_FILE} 'setup' must be a string or array of strings`);
  }

  const tabs = obj.tabs;
  if (
    tabs !== undefined &&
    !(
      Array.isArray(tabs) &&
      tabs.every(
        (t) => Array.isArray(t) && t.every((s) => typeof s === "string"),
      )
    )
  ) {
    throw new Error(`${CONFIG_FILE} 'tabs' must be an array of arrays of strings`);
  }

  const worktreesDir = obj.worktreesDir;
  if (worktreesDir !== undefined && typeof worktreesDir !== "string") {
    throw new Error(`${CONFIG_FILE} 'worktreesDir' must be a string`);
  }

  return {
    setup: setup as string | string[] | undefined,
    tabs: tabs as string[][] | undefined,
    worktreesDir: worktreesDir as string | undefined,
  };
}

export function tabCommands(cfg: Config | null): string[][] {
  if (!cfg) return [];
  if (cfg.tabs) {
    if (cfg.setup !== undefined) {
      console.warn(
        `${CONFIG_FILE}: both 'tabs' and 'setup' are set; using 'tabs' and ignoring 'setup'.`,
      );
    }
    return cfg.tabs;
  }
  if (cfg.setup) {
    const arr = Array.isArray(cfg.setup) ? cfg.setup : [cfg.setup];
    return [arr];
  }
  return [];
}

type PkgManager = "pnpm" | "bun" | "yarn" | "npm";

export function detectPackageManager(repoRoot: string): PkgManager {
  if (fs.existsSync(path.join(repoRoot, "pnpm-lock.yaml"))) return "pnpm";
  if (
    fs.existsSync(path.join(repoRoot, "bun.lock")) ||
    fs.existsSync(path.join(repoRoot, "bun.lockb"))
  ) return "bun";
  if (fs.existsSync(path.join(repoRoot, "yarn.lock"))) return "yarn";
  if (fs.existsSync(path.join(repoRoot, "package-lock.json"))) return "npm";
  return "pnpm";
}

export function hasSetupScript(repoRoot: string): boolean {
  const pkg = path.join(repoRoot, "package.json");
  if (!fs.existsSync(pkg)) return false;
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(pkg, "utf8"));
    if (typeof parsed !== "object" || parsed === null) return false;
    const scripts = (parsed as Record<string, unknown>).scripts;
    if (typeof scripts !== "object" || scripts === null) return false;
    return typeof (scripts as Record<string, unknown>).setup === "string";
  } catch {
    return false;
  }
}

export function writeDefaultConfig(repoRoot: string): void {
  const file = configPath(repoRoot);
  if (fs.existsSync(file)) {
    throw new Error(`${CONFIG_FILE} already exists at ${file}`);
  }

  const mgr = detectPackageManager(repoRoot);
  const setup = [`${mgr} install`];
  if (hasSetupScript(repoRoot)) setup.push(`${mgr} run setup`);

  const content = JSON.stringify({ setup }, null, 2) + "\n";
  fs.writeFileSync(file, content, "utf8");
  console.log(`Created ${CONFIG_FILE}:`);
  console.log(content);
}
