/**
 * Delta's AST is deliberately generic: every tag is an ElementNode keyed by `tag`.
 * Passes branch on `tag` and write computed results back into `attrs` (for instance, the
 * numbering pass writes `num`); there are no per-feature node subclasses, so adding
 * an environment is configuration, not a new node type. RawNode carries pre-rendered
 * HTML (KaTeX output) that the emitter must not escape.
 */

/** A position represents the location of a node in the source document. It is used for warning and error reporting. */
export interface Position {
  line: number;
  column: number;
}

export interface TextNode {
  type: "text";
  text: string;
}

export interface RawNode {
  type: "raw";
  html: string;
}

export interface ElementNode {
  type: "element";
  tag: string;
  attrs: Record<string, string>;
  children: Node[];
  pos?: Position;
}

export type Node = ElementNode | TextNode | RawNode;

/**
 * Extracts the text content from a node, removing all HTML tags. For text nodes, it returns the text itself. For raw nodes, it returns an empty string. For element nodes, it recursively concatenates the text content of all child nodes.
 * 
 * @param node - A node of any type
 * @returns string - flattened text content of the node and its children
 */

export function textContent(node: Node): string {
  switch (node.type) {
    case "text":
      return node.text;
    case "raw":
      return "";
    case "element":
      return node.children.map(textContent).join("");
  }
}

/**
 * 
 * Generator function that yields all ElementNode instances in a tree structure, starting from the provided root ElementNode. It traverses the tree depth-first, yielding each ElementNode it encounters.
 * 
 * @param root - An ElementNode from which to start the traversal
 * @returns Generator<ElementNode> - A generator that yields ElementNode instances
 */
export function* elements(root: ElementNode): Generator<ElementNode> {
  yield root;
  for (const child of root.children) {
    if (child.type === "element") yield* elements(child);
  }
}

/**
 * Look for an element with a given id in the tree rooted at `root`. Returns the element if found, null if not found, or undefined if multiple elements with the same id are found.
 * 
 * @param root - the root element to look for children with given id
 * @param id  - the id
 * @returns - the element with the given id, or null if not found, or undefined if multiple elements are found
 */
export function findElementById(root: ElementNode,id: string): ElementNode | null | undefined {
  let elementList: ElementNode[] = []
  for (const el of elements(root)) {
    if(el.attrs?.id === id) elementList.push(el);
  }
  if(elementList.length === 0) return null;
  if(elementList.length > 1) return undefined;
  return elementList[0];
}
