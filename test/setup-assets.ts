import { execFileSync } from "node:child_process";

/** Vitest global setup: rebuild the generated assets (the runtime bundle and the CSS) once per run. */
export default function setup(): void {
  execFileSync(process.execPath, ["--import", "tsx", "scripts/build.ts", "assets"], {
    stdio: "inherit",
  });
}
