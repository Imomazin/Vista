import test from 'node:test';
import assert from 'node:assert/strict';
import {parseReadiness,sourcePresentation,sourceDefinitions} from './source-readiness';
test('source readiness preserves false and true configuration without asserting live data',()=>{
 const data=parseReadiness({providers:{gsc:{configured:true},ga4:{configured:true},hubspot:{configured:false},openai:{configured:false}}});
 assert.deepEqual(data,{gsc:true,ga4:true,hubspot:false,openai:false});
 assert.equal(sourcePresentation(data.gsc).label,'Credentials configured');
 assert.equal(sourcePresentation(data.hubspot).label,'Setup needed');
 assert.equal(sourcePresentation(undefined).label,'Not checked');
 assert.equal(sourceDefinitions.length,4);
});
test('missing or malformed source responses never become disconnected or configured claims',()=>{
 for(const input of [null,{}, {providers:null},{providers:{}},{providers:{gsc:{configured:'true'}}}])assert.throws(()=>parseReadiness(input));
});
