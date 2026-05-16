#!/usr/bin/env bun
import { init } from "./commands/init.ts";
import { newWorkspace } from "./commands/new.ts";
import { clean } from "./commands/clean.ts";

const HELP = `cmw — cmux workspace manager

Usage:
  cmw init              Create a starter .cmux-workspace.json in the current repo
  cmw new <branch>      Spawn a cmux workspace + git worktree + run setup
  cmw clean <branch>    Remove the worktree and close the cmux workspace
`;

async function main(): Promise<void> {
  const [, , command, ...rest] = process.argv;

  switch (command) {
    case "init":
      await init();
      return;
    case "new":
      await newWorkspace(rest[0] ?? "");
      return;
    case "clean":
      await clean(rest[0] ?? "");
      return;
    case undefined:
    case "help":
    case "--help":
    case "-h":
      process.stdout.write(HELP);
      return;
    default:
      process.stderr.write(`Unknown command: ${command}\n\n${HELP}`);
      process.exit(1);
  }
}

main().catch((err: Error) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
