import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSQLiteRepository } from '../src/repositories/sqlite.js';
import { createEventService } from '../src/services/eventService.js';
import { createBookingService } from '../src/services/bookingService.js';
import { charge } from '../src/lib/mockPaymentGateway.js';

const databasePath = fileURLToPath(new URL('../data/oversell.sqlite', import.meta.url));
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
fs.rmSync(databasePath, { force: true });

const repository = createSQLiteRepository({ databasePath });
const events = createEventService(repository);
const bookings = createBookingService(repository, { charge });
const organizerId = 'oversell-organizer';

const event = await events.createEvent({
  title: 'Last Ticket Demo',
  city: 'Lagos',
  venue: 'Demo Hall',
  startsAt: '2027-06-10T18:00:00Z',
}, organizerId);
const tier = await events.addTier(event.id, {
  name: 'Last Seat',
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

const storedTier = await repository.getTier(tier.id);
const successes = results.filter((result) => result.success).length;
const soldOut = results.filter((result) => result.code === 'SOLD_OUT').length;

console.log(`Successful bookings: ${successes}`);
console.log(`SOLD_OUT responses: ${soldOut}`);
console.log(`Seats sold: ${storedTier.sold}`);
console.log(`Tier capacity: ${storedTier.capacity}`);
console.log('Before fix (reproduced): 50 successful, 0 SOLD_OUT, 1 seat sold');
console.log(`After fix: ${successes} successful, ${soldOut} SOLD_OUT, ${storedTier.sold} seat sold`);

repository.close();
