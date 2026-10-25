import test from 'node:test';
import assert from 'node:assert/strict';
import { eligiblePages, investigationFindings } from './investigation';
import { analyseHtml } from './audit';
test('discovery stays on the public origin and excludes duplicate and unsuitable links',()=>{
 assert.deepEqual(eligiblePages('https://example.com/', ['/a','#top','/a#section','https://other.com/a','javascript:alert(1)','/a?q=1','/file.pdf','/logout','mailto:a@b.com','https://user:pass@example.com/b','/b']),['https://example.com/a','https://example.com/b']);
 assert.equal(eligiblePages('https://example.com/',Array.from({length:40},(_,i)=>'/'+i)).length,20);
});
test('aggregation deduplicates pages and prioritises issues ahead of repeated warnings',()=>{
 const first=analyseHtml('https://example.com/','<title>A descriptive page title for our example</title>');
 const second=analyseHtml('https://example.com/about','<meta name="robots" content="noindex"><title>A descriptive page title for our example</title>');
 const groups=investigationFindings([first,second,second]);
 assert.equal(groups[0].id,'index');assert.equal(groups[0].issues,1);
 assert.equal(groups.find(g=>g.id==='description')?.pages.length,2);
 assert.equal(groups.some(g=>g.id==='title'),false);
});


test("multi-page investigation recognises duplicate descriptions and homepage canonicalisation",()=>{
 const make=(u:string,t:string)=>analyseHtml("https://example.com"+u,'<html><head><title>'+t+'</title><meta name="description" content="Company-wide generic description"/><link rel="canonical" href="https://example.com/"></head><body><h1>Page</h1></body></html>');
 const groups=investigationFindings([make("/about","About the company"),make("/services","Service catalogue"),make("/contact","Contact details")]);
 assert.equal(groups.find(g=>g.id==="duplicate-description")?.pages.length,3);
 assert.equal(groups.find(g=>g.id==="shared-canonical")?.pages.length,3);
 assert.equal(groups.find(g=>g.id==="canonical")?.pages.length,3);
 assert.equal(groups.find(g=>g.id==="duplicate-title"),undefined);
});
