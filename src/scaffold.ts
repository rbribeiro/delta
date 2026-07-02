/**
 * Scaffolding for the `delta create` CLI command: pure file-template builders that
 * return a `path → contents` map. `cli.ts` writes them to disk. The templates are
 * intentionally minimal — a `TODO` where the author's content goes, not a worked
 * example — so a reader sees *where* to add their prose, custom CSS, local elements,
 * and installed packages, and no more.
 */

/**
 * The author-facing tag a scaffolded package registers, derived from its name: a
 * leading `delta-` is stripped (`delta-callout` → `callout`), otherwise the name is
 * used as-is (`my-widget` → `my-widget`). The compiler renames `<tag>` to `<delta-tag>`,
 * so the pack registers `delta-${tag}`. The author renames freely afterwards.
 */
export function tagFor(name: string): string {
  return name.replace(/^delta-/, "") || name;
}

/**
 * Builds the file set for `delta create <kind> <name>`, keyed by path relative to the
 * new project/package directory. Pure (no fs) so it is unit-testable; the CLI does the
 * writing.
 */
export function scaffoldFiles(kind: "project" | "package", name: string): Record<string, string> {
  return kind === "project" ? projectFiles() : packageFiles(name);
}

/** A bare project: a project.toml wired for one file, plus that starter file. */
function projectFiles(): Record<string, string> {
  const projectToml = `# A Delta project — compile with: delta build project.toml
inputs = ["main.dlt"]   # your .dlt files, in order; add more here
out = "out"             # output directory (one standalone .html per input)

# Packages inlined into every file. Add a local pack by relative path, or an npm
# package with \`delta install <name>\` (it appends the name here for you).
packages = []

# Optional project-wide <document> defaults — each file can still override its own:
# [document]
# type = "article"      # article | book | presentation
# theme = "theme.css"   # your custom CSS, resolved relative to this file
# theme-accent = "blue"
# theme-mode = "light"  # light | dark | auto
# lang = "en"
`;

  const mainDlt = `<document>
  <title>My Document</title>
  <section>
    <title>Introduction</title>
    <!-- Write your content here. -->
    Hello, Delta.
  </section>
</document>
`;

  return { "project.toml": projectToml, "main.dlt": mainDlt };
}

/** A minimal, publishable custom-element package: source stubs + minify build + smoke test. */
function packageFiles(name: string): Record<string, string> {
  const tag = tagFor(name);
  const el = `delta-${tag}`;

  const packageJson =
    JSON.stringify(
      {
        name,
        version: "0.1.0",
        description: `A Delta package that provides <${tag}>.`,
        license: "MIT",
        files: ["dist"],
        delta: {
          js: "dist/pack.min.js",
          css: "dist/pack.min.css",
          tags: [tag],
        },
        scripts: {
          build:
            "esbuild src/index.js --bundle --format=iife --minify --outfile=dist/pack.min.js && " +
            "esbuild src/theme.css --minify --outfile=dist/pack.min.css",
          test: "node test/smoke.mjs",
          prepublishOnly: "npm run build && npm test",
        },
        devDependencies: { esbuild: "^0.28.1" },
      },
      null,
      2,
    ) + "\n";

  const indexJs = `// Delta package: registers <${tag}> (the compiler renames it to <${el}>).
// This is a classic browser script — no import/export. It runs after the core
// runtime, so \`window.Delta\` (popover, t, deck) is available if you need it.
customElements.define(
  "${el}",
  class extends HTMLElement {
    connectedCallback() {
      if (this.dataset.deltaReady) return; // can fire again when moved
      this.dataset.deltaReady = "1";
      // TODO: build your element's chrome here from this.children / attributes.
    }
  },
);
`;

  const themeCss = `/* Styles for <${el}>. Reuse the design system's --delta-* tokens (see
   AUTHORING_PACKAGES.md) so the element matches the document theme and follows
   accent + dark mode for free. Scope every selector to your tag. */
${el} {
  display: block;
  /* TODO: add your styles, e.g. color: var(--delta-ink); */
}
`;

  const smokeMjs = `// Minimal smoke test: the built pack must register the element.
// Runs after \`npm run build\`, so it checks the minified artifact.
import { readFileSync } from "node:fs";

const js = readFileSync(new URL("../dist/pack.min.js", import.meta.url), "utf8");
if (!js.includes("${el}")) {
  console.error("smoke test failed: dist/pack.min.js does not register ${el}");
  process.exit(1);
}
console.log("ok: ${el} registered");
`;

  const readme = `# ${name}

A Delta package that provides \`<${tag}>\`.

\`\`\`bash
npm install        # dev dependencies (esbuild)
npm run build      # minify src → dist/
npm test           # smoke-check the build
npm publish        # prepublishOnly runs build + test
\`\`\`

Edit \`src/index.js\` (the custom element) and \`src/theme.css\` (its styles).
`;

  const gitignore = `node_modules
dist
`;

  return {
    "package.json": packageJson,
    "src/index.js": indexJs,
    "src/theme.css": themeCss,
    "test/smoke.mjs": smokeMjs,
    "README.md": readme,
    ".gitignore": gitignore,
  };
}
