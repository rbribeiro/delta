/**
 * Localization table — Delta's `babel`. Auto-generated UI text (environment
 * labels, caption prefixes, structural words) is keyed here by language. The
 * emitter resolves the document's `lang`, inlines `stringsFor(lang)` as the
 * `#delta-i18n` data-island, and the runtime looks each key up via `t()`.
 *
 * Adding a translatable string = a key in every block. Adding a language = a
 * new block; `en` is the base every other language falls back to (`stringsFor`).
 */

const DEFAULT_LANG = "en";

export const STRINGS: Record<string, Record<string, string>> = {
  en: {
    // environment labels (one per ENVIRONMENT_TAGS entry)
    theorem: "Theorem",
    proposition: "Proposition",
    lemma: "Lemma",
    corollary: "Corollary",
    conjecture: "Conjecture",
    definition: "Definition",
    example: "Example",
    claim: "Claim",
    observation: "Observation",
    exercise: "Exercise",
    problem: "Problem",
    proof: "Proof",
    solution: "Solution",
    remark: "Remark",
    section: "Section",
    equation: "Equation",
    figure: "Figure",
    table: "Table",
    video: "Video",
    audio: "Audio",
    contents: "Contents",
    hint: "Hint",
    references: "References",
    close: "Close",
    code: "Code",
    copy: "Copy",
    copied: "Copied",
  },
  pt: {
    theorem: "Teorema",
    proposition: "Proposição",
    lemma: "Lema",
    corollary: "Corolário",
    conjecture: "Conjectura",
    definition: "Definição",
    example: "Exemplo",
    claim: "Afirmação",
    observation: "Observação",
    exercise: "Exercício",
    problem: "Problema",
    proof: "Demonstração",
    solution: "Solução",
    remark: "Comentário",
    section: "Seção",
    subsection: "Subseção",
    subsubsection: "Subsubseção",
    equation: "Equação",
    equations: "Equações",
    figure: "Figura",
    table: "Tabela",
    video: "Vídeo",
    audio: "Áudio",
    contents: "Sumário",
    hint: "Dica",
    references: "Referências",
    close: "Fechar",
    code: "Código",
    copy: "Copiar",
    copied: "Copiado",
  },
};

/** Normalize a `lang` to a key present in STRINGS: `pt-BR` → `pt`, unknown → `en`. */
export function resolveLang(lang?: string): string {
  if (!lang) return DEFAULT_LANG;
  const lower = lang.toLowerCase();
  if (STRINGS[lower]) return lower;
  const base = lower.split("-")[0];
  if (STRINGS[base]) return base;
  return DEFAULT_LANG;
}

/** Merged string set for a resolved language with `en` base overlaid by the language,
 *  so any key a language omits falls back to English. Pass a `resolveLang` result. */
export function stringsFor(lang: string): Record<string, string> {
  return { ...STRINGS[DEFAULT_LANG], ...(STRINGS[lang] ?? {}) };
}
