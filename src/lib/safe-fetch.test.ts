import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchPublicHtml} from './safe-fetch';
test('public scanner rejects local hosts, credentials, custom ports and non-HTTPS inputs before networking',async()=>{for(const url of ['http://example.com','https://localhost','https://127.0.0.1','https://[::1]','https://user:secret@example.com','https://example.com:8443','file:///etc/passwd','https://internal.local'])await assert.rejects(fetchPublicHtml(url),/public HTTPS/);});
