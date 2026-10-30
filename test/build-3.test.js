import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { DomainError } from '../src/domain/errors.js';
import {
  assertTransition,
  BOOKING_STATES,
  BOOKING_TRANSITIONS,
  canTransition,
} from '../src/domain/bookingStateMachine.js';
import { createApp } from '../src/http/app.js';
import { Router } from '../src/http/router.js';
import { loadConfig } from '../src/config.js';

describe('booking state machine', () => {
test('permits every specified transition', () => {
  const allowed = [
    ['pending', 'paid'],
    ['pending', 'cancelled'],
    ['paid', 'checked_in'],
    ['paid', 'refunded'],
    ['paid', 'cancelled'],
  ];

  for (const [from, to] of allowed) {
    assert.equal(canTransition(from, to), true);
    assert.equal(assertTransition(from, to), true);
  }
});

test('refuses every unspecified transition', () => {
  const states = Object.values(BOOKING_STATES);
  for (const from of states) {
    for (const to of states) {
      if (BOOKING_TRANSITIONS[from].includes(to)) continue;
      assert.equal(canTransition(from, to), false, `${from} must not transition to ${to}`);
      assert.throws(() => assertTransition(from, to), (error) => (
        error instanceof DomainError && error.code === 'INVALID_TRANSITION'
      ));
    }
  }
});

test('rejects unknown states', () => {
  assert.equal(canTransition('unknown', 'paid'), false);
  assert.throws(() => assertTransition('pending', 'unknown'), (error) => (
    error instanceof DomainError && error.code === 'INVALID_TRANSITION'
  ));
});
});

describe('router', () => {
test('router matches method and path parameters', () => {
  const handler = () => ({ status: 'ok' });
  const router = new Router().add('get', '/events/:eventId/bookings/:bookingId', handler);
  const match = router.match('GET', '/events/event%201/bookings/booking-2');

  assert.equal(match.handler, handler);
  assert.deepEqual(match.params, { eventId: 'event 1', bookingId: 'booking-2' });
  assert.equal(router.match('POST', '/events/event%201/bookings/booking-2'), null);
  assert.equal(router.match('GET', '/events/event-1/bookings'), null);
});
});

describe('server config', () => {
test('server config defaults the port and accepts a valid PORT override', () => {
  assert.deepEqual(loadConfig({}), { port: 3000 });
  assert.deepEqual(loadConfig({ PORT: '4200' }), { port: 4200 });
  assert.deepEqual(loadConfig({ PORT: '0' }), { port: 0 });
  assert.throws(() => loadConfig({ PORT: 'not-a-port' }), RangeError);
});
});

function request(server, path, { method = 'GET', body } = {}) {
  const address = server.address();
  return new Promise((resolve, reject) => {
    const outgoing = http.request({
      hostname: '127.0.0.1',
      port: address.port,
      path,
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
    }, (incoming) => {
      const chunks = [];
      incoming.on('data', (chunk) => chunks.push(chunk));
      incoming.on('end', () => resolve({
        statusCode: incoming.statusCode,
        contentType: incoming.headers['content-type'],
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    outgoing.on('error', reject);
    if (body !== undefined) outgoing.write(body);
    outgoing.end();
  });
}

describe('HTTP app', () => {
test('serves health, routes, JSON errors, and only files inside public', async () => {
  const router = new Router()
    .add('POST', '/api/echo', ({ body }) => ({ received: body }))
    .add('GET', '/api/failure', () => {
      throw new Error('private stack detail');
    });
  const app = createApp({
    router,
    publicDir: fileURLToPath(new URL('../public/', import.meta.url)),
  });
  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));

  try {
    const health = await request(app, '/health');
    assert.equal(health.statusCode, 200);
    assert.deepEqual(JSON.parse(health.body), { status: 'ok' });

    const echo = await request(app, '/api/echo', { method: 'POST', body: '{"ok":true}' });
    assert.equal(echo.statusCode, 200);
    assert.deepEqual(JSON.parse(echo.body), { received: { ok: true } });

    const badJson = await request(app, '/api/echo', { method: 'POST', body: '{bad json' });
    assert.equal(badJson.statusCode, 400);
    assert.deepEqual(JSON.parse(badJson.body), {
      error: { code: 'INVALID_JSON', message: 'Request body must contain valid JSON' },
    });

    const failure = await request(app, '/api/failure');
    assert.equal(failure.statusCode, 500);
    assert.deepEqual(JSON.parse(failure.body), {
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
    assert.equal(failure.body.includes('private stack detail'), false);

    const missingApi = await request(app, '/api/missing');
    assert.equal(missingApi.statusCode, 404);
    assert.deepEqual(Object.keys(JSON.parse(missingApi.body)), ['error']);

    const page = await request(app, '/');
    assert.equal(page.statusCode, 200);
    assert.match(page.body, /Event Ticketing/);

    const traversal = await request(app, '/..%2fREADME.md');
    assert.equal(traversal.statusCode, 403);
    assert.deepEqual(JSON.parse(traversal.body).error, {
      code: 'FORBIDDEN',
      message: 'Path is outside the public directory',
    });
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});
});