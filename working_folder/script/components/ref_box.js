// RefBox component to display referenced content in a popup box
class RefBox extends HTMLElement {
    connectedCallback() {
        const refId = this.getAttribute("ref-id");
        if (!refId) {
            console.error("ref-id attribute is required");
            return;
        }

        const ref = document.getElementById(refId).cloneNode(true);
        if (!ref) {
            console.error(`Element with id ${refId} not found`);
            return;
        }

        this.innerHTML = `
            <div class="ref-wrapper">
                <div class="ref-content">
                    <span class="close-ref">&times;</span>
                </div>
            </div>
            `;
        
        const refContent = this.querySelector(".ref-content");
        refContent.appendChild(ref);

        const closeBtn = this.querySelector(".close-ref");
        closeBtn.addEventListener("click", () => this.remove());
    }
}

customElements.define("ref-box", RefBox);
