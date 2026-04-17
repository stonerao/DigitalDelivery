export function buildTreeNodeIndex(root) {
  const nodeMap = new Map();
  const parentMap = new Map();
  if (!root) return { nodeMap, parentMap };

  const stack = [{ node: root, parentUuid: null }];
  while (stack.length) {
    const { node, parentUuid } = stack.pop();
    if (!node?.uuid) continue;
    nodeMap.set(node.uuid, node);
    if (parentUuid) parentMap.set(node.uuid, parentUuid);
    const children = Array.isArray(node.children) ? node.children : [];
    for (let i = 0; i < children.length; i++) {
      stack.push({ node: children[i], parentUuid: node.uuid });
    }
  }

  return { nodeMap, parentMap };
}
