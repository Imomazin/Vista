import test from 'node:test';
import assert from 'node:assert/strict';
import {readRoute,routeHash} from './navigation';
test('tools and workspace sections roundtrip through shareable routes',()=>{for(const view of ['experience','command','audit','investigation','benchmark','content','engines'] as const)assert.equal(readRoute(routeHash(view)).view,view);for(const tab of ['Projects','Audit history','Action board','Content studio','AI exposure','Connections'] as const)assert.deepEqual(readRoute(routeHash('workspace',tab)),{view:'workspace',tab,engine:3});});
test('unknown routes fall back safely',()=>{assert.equal(readRoute('#missing').view,'experience');assert.equal(readRoute('#workspace/missing').tab,'Projects');});

test("every engine survives refresh and history routing",()=>{for(const engine of [1,2,3,4,5,6,7,8,9] as const)assert.equal(readRoute(routeHash("engines","Projects",engine)).engine,engine);assert.equal(readRoute("#engines/99").engine,3);});
