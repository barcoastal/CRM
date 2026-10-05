/** Extract source passages, without inventing or reinterpreting contract terms. */
export function documentHighlights(pages: string[]) {
  const seen = new Set<string>();
  return pages.flatMap((text, index) => {
    const sentences = text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z])/);
    return sentences.filter(text => text.length > 55 && text.length < 1000 && /fee|payment|duration|terminat|cancel|responsibil|authoriz|settlement|withdraw/i.test(text))
      .map(text => ({page:index + 1,text}));
  }).filter(item => {
    if (seen.has(item.text)) return false;
    seen.add(item.text); return true;
  }).slice(0, 10);
}
