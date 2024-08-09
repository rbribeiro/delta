const deltaConfig = {
  state: {},
  type: "presentation",
  environmentEnumeration: "default",
  environments: [
    "theorem",
    "proof",
    "proposition",
    "lemma",
    "example",
    "remark",
    "corollary",
  ],
  plugins: [
    {
      id: "annotation",
      src: "./library/plugins/annotation/annotation.js",
    },
  ],
};
