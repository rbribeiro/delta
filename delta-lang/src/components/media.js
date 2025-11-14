// delta-lang/src/components/media.js

class DeltaYouTube extends HTMLElement {
  constructor() {
    super();
 
  }

  connectedCallback() {
    const url = this.getAttribute('data-url');
    const width = this.getAttribute('data-width') || '100%';
    const height = this.getAttribute('data-height') || '360';
    const number = this.getAttribute('data-number')
    const title = this.getAttribute('data-title')

    const caption = this.querySelector('delta-caption');

    let videoId = '';
    if (url) {
      const match = url.match(
        /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
      );
      if (match) {
        videoId = match[1];
      }
    }

    // Clear previous content
    this.innerHTML = '';

    // Create wrapper with class
    const wrapper = document.createElement('div');
    wrapper.className = 'wrapper';


    if (title) {
          const titleElem = document.createElement('div');
          titleElem.className = 'video-title';
          titleElem.textContent = title;
          this.appendChild(titleElem);
        }
 
    if (url) {
      try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes('youtu.be')) {
          videoId = urlObj.pathname.slice(1);
        } else {
          videoId = urlObj.searchParams.get('v');
        }
      } catch (e) {
        wrapper.textContent = "Invalid URL"
      }
    }


    if (videoId) {
      const iframe = document.createElement('iframe');
      iframe.width = width;
      iframe.height = height;
      wrapper.style.with = width
      wrapper.style.height = height
      iframe.src = `https://www.youtube.com/embed/${videoId}`;
      iframe.frameBorder = '0';
      iframe.allow =
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      iframe.className = 'youtube-embed-iframe';
      wrapper.appendChild(iframe);

      if (caption) {
        const videoTag = document.createElement('span')
        videoTag.classList.add('video-tag')
        videoTag.textContent = number ? `Video ${number}. ` : "Video. "
        caption.firstChild.prepend(videoTag)
        wrapper.appendChild(caption);
      }
    } else {
      wrapper.textContent = 'Invalid YouTube URL';
    }

    this.appendChild(wrapper);
  }

}

customElements.define("delta-youtube",DeltaYouTube)
console.log('Media components loaded');
