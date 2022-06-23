export function formatDocs(docs: string): string {
  let secondParagraphIndex = docs.indexOf('.\n');
  
  if (secondParagraphIndex == -1) {
    return docs;
  }
  
  return docs.slice(0, secondParagraphIndex + 1);
}
