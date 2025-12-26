import test from 'node:test';
import assert from 'node:assert';
import semantic from '../src/semantic-router.ts';

let lastCall: string | undefined;

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

test('Concurrent calls should not trigger MaxListenersExceededWarning', async () =>
{
  const router = semantic();
  const promises = [];
  for (let i = 0; i < 20; i++) {
    promises.push(router.embed([`concurrency test ${i}`]));
  }
  const results = await Promise.all(promises);
  assert.strictEqual(results.length, 20);
});

