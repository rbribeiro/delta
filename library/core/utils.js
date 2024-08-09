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
