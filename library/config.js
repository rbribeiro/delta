const deltaConfig = {
  state: {},
  type: "presentation",
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
