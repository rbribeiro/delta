    const menuBtn = document.getElementById("menu-btn");
    const sidebar = document.querySelector(".sidebar");

    menuBtn.addEventListener("click", () => {
      sidebar.classList.toggle("hidden");
    });


  document.querySelectorAll("example").forEach(ex => {
    const header = ex.querySelector(".example-header");
    const content = ex.querySelector(".example-content");

    header.addEventListener("click", () => {
      content.style.display =
        content.style.display === "block" ? "none" : "block";
    });
  });



  document.querySelectorAll("example").forEach(ex => {
    const header = ex.querySelector(".example-header");
    const content = ex.querySelector(".example-content");

    header.addEventListener("click", () => {
      const isOpen = ex.classList.toggle("open");
      content.style.display = isOpen ? "block" : "none";
    });
  });

  document.querySelectorAll("demonstration").forEach(demo => {
    const header = demo.querySelector(".demo-header");
    const content = demo.querySelector(".demo-content");

    header.addEventListener("click", () => {
      const isOpen = demo.classList.toggle("open");
      content.style.display = isOpen ? "block" : "none";
    });
  });

// Botão de aumentar fonte
  const content = document.getElementById("content");
  const increaseBtn = document.getElementById("increase-font");
  const decreaseBtn = document.getElementById("decrease-font");

  increaseBtn.addEventListener("click", () => {
    let style = window.getComputedStyle(content).fontSize;
    let currentSize = parseFloat(style);
    content.style.fontSize = (currentSize + 5) + "px";
  });

  decreaseBtn.addEventListener("click", () => {
    let style = window.getComputedStyle(content).fontSize;
    let currentSize = parseFloat(style);
    if(currentSize > 8) content.style.fontSize = (currentSize - 5) + "px";
  });
