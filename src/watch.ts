import { type FSWatcher, watch } from "node:fs";
import { basename, dirname } from "node:path";

/**
 * Builds once, then watches every dependency and rebuilds on change. Keeps running
 * through compile errors so the author can fix and see it recover. Watches the
 * directories containing the deps and filters events to the dep basenames, which is
 * robust to editors' atomic save-as-rename and means writing the output file (not a
 * source dep) never triggers a rebuild loop.
 *
 * The watchers stay open across builds, so a save that lands while a build runs is
 * queued and triggers the next one. They are recreated only when the dep set changed
 * (an `<include>` added or removed, a figure renamed).
 */
export function watchAndRebuild(build: () => string[], log: (line: string) => void): void {
  let watchers: FSWatcher[] = [];
  let watched = "";
  let timer: NodeJS.Timeout | undefined;

  const trigger = (): void => {
    clearTimeout(timer);
    timer = setTimeout(rebuild, 80); // debounce the burst editors emit per save
  };

  const watchDeps = (deps: string[]): void => {
    const key = [...deps].sort().join("\n");
    if (key === watched) return;
    watched = key;
    for (const w of watchers) w.close();
    watchers = [];

    const byDir = new Map<string, Set<string>>();
    for (const f of deps) {
      const dir = dirname(f);
      let names = byDir.get(dir);
      if (!names) byDir.set(dir, (names = new Set()));
      names.add(basename(f));
    }
    for (const [dir, names] of byDir) {
      try {
        watchers.push(
          watch(dir, (_event, filename) => {
            if (filename && names.has(filename)) trigger();
          }),
        );
      } catch {
        // a missing/inaccessible directory just isn't watched
      }
    }
    log(`watching ${deps.length} files… (Ctrl-C to stop)\n`);
  };

  function rebuild(): void {
    watchDeps(build());
  }

  rebuild(); // initial build + watch
}
