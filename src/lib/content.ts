export function analyseContent(text: string, keyword: string) {
  const words = text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || [];
  const sentences = text.split(/[.!?]+(?:\s|$)/).filter(s=>s.trim());
  const headings = text.split('\n').filter(line=>/^#{1,6}\s+\S/.test(line));
  const paragraphs = text.split(/\n\s*\n/).filter(s=>s.trim());
  const links = text.match(/https?:\/\/[^\s)]+/g) || [];
  const term = keyword.trim().toLocaleLowerCase();
  const phraseWords = term.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || [];
  const normalised = words.map(w=>w.toLocaleLowerCase());
  let mentions=0;
  if(phraseWords.length) for(let i=0;i<=normalised.length-phraseWords.length;i++) if(phraseWords.every((w,j)=>normalised[i+j]===w)) mentions++;
  const sentenceAverage = sentences.length ? Math.round(words.length / sentences.length) : 0;
  const checks = [
    {name:'Clear structure',pass:headings.length>0,detail:headings.length ? `${headings.length} Markdown headings found.` : 'Add Markdown headings to organise the draft.'},
    {name:'Readable sentence length',pass:words.length>0 && sentenceAverage<=25,detail:words.length ? `${sentenceAverage} words per sentence on average. Review long sentences for clarity.` : 'Add a draft to assess sentence length.'},
    {name:'Source references',pass:links.length>0,detail:links.length ? `${links.length} URL references found. Verify that they support your claims.` : 'Add source URLs where factual claims need supporting evidence.'},
    {name:'Topic coverage',pass:!!term&&mentions>0,detail:term ? `${mentions} exact word-sequence mentions of your focus topic. This is not a ranking signal or density target.` : 'Set a focus topic to check exact mentions.'},
    {name:'Scannable paragraphs',pass:paragraphs.length>1,detail:`${paragraphs.length} paragraphs separated by blank lines.`}
  ];
  return {wordCount:words.length,readingMinutes:words.length ? Math.max(1,Math.ceil(words.length/200)):0,headings:headings.length,paragraphs:paragraphs.length,links:links.length,mentions,sentenceAverage,checks};
}
