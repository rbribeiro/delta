console.log("Project components loaded")


class DeltaProject extends HTMLElement {
  constructor() {
    super()
  }

  connectedCallback() {

    const title = this.getAttribute("title") || "Delta Document" /*tab title*/
    console.log('Atributo title:', title); /*bug in default title*/
    const author = this.getAttribute("author") || null /*author's name */
    const type = this.getAttribute("type") || null /*simple-page*/
    const font = this.getAttribute("font") || null /**/
    const theme = this.getAttribute("theme") || null /**/
    }
    
} 

customElements.define("delta-project", DeltaProject)


