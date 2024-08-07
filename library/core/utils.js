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
