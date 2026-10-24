import test from 'node:test';
import assert from 'node:assert/strict';
import {readRoute,routeHash} from './navigation';
test('tools and workspace sections roundtrip through shareable routes',()=>{for(const view of ['experience','command','audit','investigation','benchmark','content','engines'] as const)assert.equal(readRoute(routeHash(view)).view,view);for(const tab of ['Projects','Audit history','Action board','Content studio','AI exposure','Connections'] as const)assert.deepEqual(readRoute(routeHash('workspace',tab)),{view:'workspace',tab});});
test('unknown routes fall back safely',()=>{assert.equal(readRoute('#missing').view,'experience');assert.equal(readRoute('#workspace/missing').tab,'Projects');});
