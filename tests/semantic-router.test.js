import test from 'node:test';
import assert from 'node:assert';
import semantic from '../src/semantic-router.js';

/** @type {unknown|string} */
let lastCall;

const app = semantic();

app.on('toolcall', [
  'use the tool',
  'retrieve data from database',
  'look up from files',
  'read the file'
], () => {
  console.log('A tool was called');
  lastCall = 'toolcall';
});

app.on('dbquery', [
  'retrieve from database',
  'data from database',
  'query database',
  'look up from files',
  'read the file'
], () => {
  console.log('DB query was called');
  lastCall = 'dbquerycall';
});

app.on('reply', [
  'reply the user with following',
  'get back to user',
  'message for human',
  'send message'
], () => {
  console.log('reply was called');
  lastCall = 'replycall';
});

test('Tool call intent', async () => {
  await app.route('I decided to call a tool, I need to retrieve information');
  assert.strictEqual(lastCall, 'toolcall');
});

test('DB query intent', async () => {
  await app.route('we need to query database for this information');
  assert.strictEqual(lastCall, 'dbquerycall');
});

test('Reply intent', async () => {
  await app.route('reply is: "there is no saved information about this"');
  assert.strictEqual(lastCall, 'replycall');
});