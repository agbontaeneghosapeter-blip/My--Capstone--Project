import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSQLiteRepository } from '../src/repositories/sqlite.js';
import { createEventService } from '../src/services/eventService.js';
import { createBookingService } from '../src/services/bookingService.js';
import { charge } from '../src/lib/mockPaymentGateway.js';

test('50 simultaneous bookings for one seat give exactly one success', async () => {
  const databasePath = fileURLToPath(new URL('../data/oversell-test.sqlite', import.meta.url));
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  fs.rmSync(databasePath, { force: true });

  const repository = createSQLiteRepository({ databasePath });
  try {
    const events = createEventService(repository);
    const bookings = createBookingService(repository, { charge });
    const organizerId = 'oversell-test-organizer';

    const event = await events.createEvent({
      title: 'Concurrent Booking Test',
      city: 'Lagos',
      startsAt: '2027-06-10T18:00:00Z',
    }, organizerId);
    const tier = await events.addTier(event.id, {
      name: 'General',
      priceCents: 1000,
      capacity: 1,
    }, organizerId);
    await events.publishEvent(event.id, organizerId);

    const results = await Promise.all(
      Array.from({ length: 50 }, (_, index) => (
        bookings.createBooking({ tierId: tier.id, quantity: 1 }, `attendee-${index + 1}`)
          .then(() => ({ success: true }))
          .catch((error) => ({ success: false, code: error.code }))
      )),
    );

    const successes = results.filter((result) => result.success).length;
    const soldOut = results.filter((result) => result.code === 'SOLD_OUT').length;
    const storedTier = await repository.getTier(tier.id);

    assert.equal(successes, 1);
    assert.equal(soldOut, 49);
    assert.equal(storedTier.sold, 1);
  } finally {
    repository.close();
    fs.rmSync(databasePath, { force: true });
  }
});
