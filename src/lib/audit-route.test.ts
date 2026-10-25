import test from 'node:test';import assert from 'node:assert/strict';import {POST} from '../app/api/audit/route';
const base='https://vista.example/api/audit';
function request(body:string,origin='https://vista.example'){return new Request(base,{method:'POST',headers:{origin,'Content-Type':'application/json','x-real-ip':crypto.randomUUID()},body});}
test('public audit route rejects cross-origin, oversized and malformed requests before retrieval',async()=>{assert.equal((await POST(request('{"url":"https://example.com"}','https://attacker.example'))).status,403);assert.equal((await POST(request('x'.repeat(5000)))).status,413);assert.equal((await POST(request('{bad'))).status,400);assert.equal((await POST(request('{"url":"https://localhost"}'))).status,422);});
