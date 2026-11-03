import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/http/app.js';
import { charge as mockCharge } from '../src/lib/mockPaymentGateway.js';

async function withServer(run, appOptions = {}) {
  const server = createApp(appOptions);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(async (path, { method = 'GET', userId, body } = {}) => {
      const headers = {};
      if (userId !== undefined) headers['x-user-id'] = userId;
      if (body !== undefined) headers['content-type'] = 'application/json';
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const responseBody = response.status === 204 ? undefined : await response.json();
      return { status: response.status, body: responseBody };
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test('real API creates, publishes, searches, books and pays tickets', async () => {
  const chargeRequests = [];
  await withServer(async (request) => {
    const organizer = 'organizer-1';
    const attendee = 'attendee-1';
    const created = await request('/api/events', {
      method: 'POST',
      userId: organizer,
      body: {
        title: 'Lagos Jazz Night',
        city: 'Lagos',
        venue: 'Civic Hall',
        startsAt: '2027-05-10T18:00:00Z',
      },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.status, 'draft');
    assert.equal(created.body.organizerId, organizer);
    const eventId = created.body.id;

    const tier = await request(`/api/events/${eventId}/tiers`, {
      method: 'POST',
      userId: organizer,
      body: { name: 'General', priceCents: 1250, capacity: 3 },
    });
    assert.equal(tier.status, 201);
    assert.equal(tier.body.sold, 0);

    const published = await request(`/api/events/${eventId}/publish`, {
      method: 'POST',
      userId: organizer,
    });
    assert.equal(published.status, 200);
    assert.equal(published.body.status, 'published');

    const search = await request('/api/events?q=JAZZ&city=lagos&maxPriceCents=1250&sortBy=price');
    assert.equal(search.status, 200);
    assert.equal(search.body.length, 1);
    assert.equal(search.body[0].tiers[0].seatsLeft, 3);

    const booking = await request('/api/bookings', {
      method: 'POST',
      userId: attendee,
      body: { tierId: tier.body.id, quantity: 2 },
    });
    assert.equal(booking.status, 201);
    assert.equal(booking.body.status, 'pending');
    assert.equal(booking.body.amountCents, 2500);
    assert.match(booking.body.reference, /^[A-HJ-NP-Z2-9]{8}$/);

    const declined = await request(`/api/bookings/${booking.body.reference}/pay`, {
      method: 'POST',
      userId: attendee,
      body: { decline: true, cardNumber: 'not-forwarded' },
    });
    assert.equal(declined.status, 402);
    assert.equal(declined.body.error.code, 'PAYMENT_DECLINED');

    const wrongAttendee = await request(`/api/bookings/${booking.body.reference}/pay`, {
      method: 'POST',
      userId: 'attendee-2',
    });
    assert.equal(wrongAttendee.status, 403);
    assert.equal(wrongAttendee.body.error.code, 'FORBIDDEN');

    const paid = await request(`/api/bookings/${booking.body.reference}/pay`, {
      method: 'POST',
      userId: attendee,
    });
    assert.equal(paid.status, 200);
    assert.equal(paid.body.status, 'paid');

    const chargedAgain = await request(`/api/bookings/${booking.body.reference}/pay`, {
      method: 'POST',
      userId: attendee,
    });
    assert.equal(chargedAgain.status, 409);
    assert.equal(chargedAgain.body.error.code, 'INVALID_TRANSITION');
    assert.deepEqual(chargeRequests, [
      { amountCents: 2500, shouldDecline: true },
      { amountCents: 2500, shouldDecline: false },
    ]);
  }, {
    paymentGateway: {
      async charge(request) {
        chargeRequests.push(request);
        return mockCharge(request);
      },
    },
  });
});

test('real API rejects invalid requests and cancels pending bookings only', async () => {
  await withServer(async (request) => {
    const noIdentity = await request('/api/events', {
      method: 'POST',
      body: { title: 'No organizer', city: 'Lagos', startsAt: '2027-05-10' },
    });
    assert.equal(noIdentity.status, 400);
    assert.equal(noIdentity.body.error.code, 'VALIDATION');

    const created = await request('/api/events', {
      method: 'POST',
      userId: 'organizer-1',
      body: { title: 'Live Show', city: 'Lagos', startsAt: '2027-05-10' },
    });
    const eventId = created.body.id;
    const emptyPublish = await request(`/api/events/${eventId}/publish`, {
      method: 'POST',
      userId: 'organizer-1',
    });
    assert.equal(emptyPublish.status, 409);
    assert.equal(emptyPublish.body.error.code, 'INVALID_STATE');

    const tier = await request(`/api/events/${eventId}/tiers`, {
      method: 'POST',
      userId: 'organizer-1',
      body: { name: 'General', priceCents: 500, capacity: 1 },
    });
    await request(`/api/events/${eventId}/publish`, {
      method: 'POST',
      userId: 'organizer-1',
    });

    const booking = await request('/api/bookings', {
      method: 'POST',
      userId: 'attendee-1',
      body: { tierId: tier.body.id, quantity: 1 },
    });
    const cancelled = await request(`/api/bookings/${booking.body.reference}/cancel`, {
      method: 'POST',
      userId: 'attendee-1',
    });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.status, 'cancelled');

    const paidCancelled = await request(`/api/bookings/${booking.body.reference}/pay`, {
      method: 'POST',
      userId: 'attendee-1',
    });
    assert.equal(paidCancelled.status, 409);
    assert.equal(paidCancelled.body.error.code, 'INVALID_TRANSITION');

    const availableAgain = await request('/api/bookings', {
      method: 'POST',
      userId: 'attendee-2',
      body: { tierId: tier.body.id, quantity: 1 },
    });
    assert.equal(availableAgain.status, 201);

    const invalidSearch = await request('/api/events?maxPriceCents=1.5');
    assert.equal(invalidSearch.status, 400);
    assert.equal(invalidSearch.body.error.code, 'VALIDATION');
  });
});
