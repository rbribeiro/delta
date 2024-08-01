const Delta = {
    state: {
      currentSlide: 1,
      totalSlides: 0,
      environmentList: [
        "theorem",
        "proof",
        "proposition",
        "lemma",
        "example",
        "remark",
        "corollary",
      ],
    },
    plugins: [
      {
        id : "navigation",
        src : "./library/plugins/navigation/navigation.js"
      },
      {
        id: "progressBar",
        src: "./library/plugins/progressBar/progressBar.js",
      },
      {
        id: "annotation",
        src: "./library/plugins/annotation/annotation.js",
      },
      {
        id: "slideCounter",
        src: "./library/plugins/counter/counter.js",
      },
      {
        id: "MathJax",
        src: "https://cdn.jsdelivr.net/npm/mathjax@2/MathJax.js?config=TeX-AMS_CHTML",
      },
      {
        id : "tableContents",
        src : "./library/plugins/tableOfContents/tableOfContents.js"
      },
      {
        id: "autogenerateSectionSlides",
        src: "./library/plugins/autogenerateSectionSlides/autogenerateSectionSlides.js",
      },
    ],
  };