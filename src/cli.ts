#!/usr/bin/env node
/**
 * The `delta` executable (bundled to dist/cli.js). The commands live in commands.ts; this
 * file only runs one with the process's arguments. `process.exitCode`, not `process.exit`,
 * so `build --watch` keeps the process alive for as long as its watchers are open.
 */
import { main } from "./commands";

process.exitCode = main(process.argv.slice(2));
