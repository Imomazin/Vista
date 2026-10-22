import test from 'node:test';
import assert from 'node:assert/strict';
import { analyseContent } from './content';
test('empty drafts return zero counts and no fabricated reading time',()=>{
 const r=analyseContent('','');assert.equal(r.wordCount,0);assert.equal(r.readingMinutes,0);assert.equal(r.mentions,0);assert.equal(r.checks.find(c=>c.name==='Readable sentence length')?.pass,false);
});
test('topic mentions match whole word sequences, not substrings',()=>{
 const r=analyseContent('Art matters. Artificial art is different. ART!','art');assert.equal(r.mentions,3);
 const phrase=analyseContent('Marketing intelligence helps. Marketing, intelligence evolves.','marketing intelligence');assert.equal(phrase.mentions,2);
});
test('recognises Markdown headings, source links and paragraphs',()=>{
 const r=analyseContent('# Evidence\n\nA short sentence.\n\n## Sources\nhttps://example.com','evidence');assert.equal(r.headings,2);assert.equal(r.paragraphs,3);assert.equal(r.links,1);assert.equal(r.mentions,1);assert.equal(r.readingMinutes,1);
});
test('handles unicode words and regex characters in a focus topic',()=>{
 assert.equal(analyseContent('Café café','café').mentions,2);assert.doesNotThrow(()=>analyseContent('Draft text','[.*]'));
});
