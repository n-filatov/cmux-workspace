import { repoRoot } from "../git.ts";
import { writeDefaultConfig } from "../config.ts";

export async function init(): Promise<void> {
  const root = repoRoot();
  writeDefaultConfig(root);
}
