export default function insertAfter(node, {nextSibling, parentNode}) {
  return parentNode.insertBefore(node, nextSibling);
}
