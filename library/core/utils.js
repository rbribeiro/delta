Node.prototype.findParentByTagName = function (tagName) {
	let currentElement = this.parentElement;
	while (currentElement) {
		if (currentElement.tagName.toLowerCase() === tagName.toLowerCase()) {
			return currentElement;
		}
		currentElement = currentElement.parentElement;
	}
	return null;
};

Node.prototype.findParentByClass = function (className) {
	let currentElement = this.parentElement;
	while (currentElement) {
		if (currentElement.classList.contains(className)) {
			return currentElement;
		}
		currentElement = currentElement.parentElement;
	}
	return null;
};

class GetElement extends HTMLElement {
	constructor() {
		super();
	}

	observedAttributes() {
		return ["target"];
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (name == "target") {
			this.render();
		}
	}

	connectedCallback() {
		this.render();
	}

	render() {
		this.innerHTML = "";
		const targetId = this.target;
		const target = document.getElementById(targetId);

		if (target) {
			this.innerHTML = target.innerHTML;
		}
	}

	observeTarget(id) {
		if (this.observer) {
			this.observer.disconnect();
		}

		const target = document.getElementById(id);
    if(target) {
      this.observer = new MutationObserver(() => this.render())
      this.observer.observe(target, {attributes : true, childList : true})
      this.render()
    }
	}
}

Delta.getInstance().eventDispatcher.on("deltaIsReady", () => {
  customElements.define("get-elem", GetElement)
})
