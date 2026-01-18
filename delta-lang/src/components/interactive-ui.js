class DeltaGeoGebra extends HTMLElement {
  constructor() {
    super();
  }

 connectedCallback() {
    const url = this.getAttribute('data-url') || '';
    const materialId = this.extractMaterialId(url);
    
    if (!materialId) return;
    
    const width = this.getAttribute('data-width') || '800';
    const height = this.getAttribute('data-height') || '600';
    const border = this.getAttribute('data-border-color') || 'FFFFFF';
    const toolbar = this.getAttribute('data-toolbar') || 'false';
    const menuBar = this.getAttribute('data-menubar') || 'false';
    const fullscreen = this.getAttribute('data-fullscreen') || 'true';
    const title = this.getAttribute('data-title');
    const caption = this.querySelector('delta-caption')


    const wrapper = document.createElement('div');
    wrapper.classList.add('wrapper')

    if (title) {
      const titleDiv = document.createElement('div');
      titleDiv.textContent = title;
      titleDiv.classList.add('video-tag')
      this.appendChild(titleDiv);
    }

    const iframe = document.createElement('iframe');
   iframe.src = `https://www.geogebra.org/material/iframe/id/${materialId}`
      + `/width/${width}`
      + `/height/${height}`
      + `/border/${border}`
      + `/sfsb/${fullscreen}`
      + `/smb/${menuBar}`
      + `/stb/${toolbar}`;
    iframe.width = width;
    iframe.height = height;
    wrapper.style.width =  width
    wrapper.style.height = height
    iframe.allowTransparency = "true";
    iframe.style.background = "transparent";
    wrapper.appendChild(iframe);

    this.appendChild(wrapper);
  }

  extractMaterialId(url) {
    const match = url.match(/(?:material\/(?:iframe\/id\/)?|m\/)([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  }
}

customElements.define('delta-geogebra', DeltaGeoGebra);


console.log('Interactive UI loaded');
