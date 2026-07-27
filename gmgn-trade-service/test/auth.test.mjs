import assert from 'node:assert/strict';
import test from 'node:test';

import { isAuthorized } from '../src/auth.mjs';
import { readJson } from '../src/http-body.mjs';

function request(secret) {
  return { headers: secret === undefined ? {} : { 'x-gmgn-hook-secret': secret } };
}

test('dry-run remains available without a hook secret', () => {
  assert.equal(isAuthorized(request(), { mode: 'dry-run', hookSecret: '' }), true);
});

test('live and paper execution fail closed without a hook secret', () => {
  assert.equal(isAuthorized(request(), { mode: 'live', hookSecret: '' }), false);
  assert.equal(isAuthorized(request(), { mode: 'paper-execution', hookSecret: '' }), false);
});

test('configured hook secret must match exactly', () => {
  const config = { mode: 'live', hookSecret: 'expected-secret' };
  assert.equal(isAuthorized(request(), config), false);
  assert.equal(isAuthorized(request('wrong-secret'), config), false);
  assert.equal(isAuthorized(request('expected-secret'), config), true);
});

test('webhook JSON reader rejects bodies larger than one MiB', async () => {
  const requestBody = {
    async *[Symbol.asyncIterator]() {
      yield Buffer.alloc(1024 * 1024);
      yield Buffer.from('x');
    }
  };
  await assert.rejects(readJson(requestBody), (error) => error.statusCode === 413);
});
