import { createSQLiteRepository } from '../src/repositories/sqlite.js';
import { createEventService } from '../src/services/eventService.js';

const repository = createSQLiteRepository();
const events = createEventService(repository);

const organizerId = 'seed-organizer';
const existing = (await repository.listEvents()).find((event) => (
  event.title === 'Lagos Jazz Night' && event.organizerId === organizerId
));

if (existing) {
  const tiers = await repository.listTiersForEvent(existing.id);
  console.log(JSON.stringify({
    eventId: existing.id,
    tierId: tiers[0]?.id,
    capacity: tiers[0]?.capacity,
    alreadySeeded: true,
  }, null, 2));
  repository.close();
} else {
  const event = await events.createEvent({
    title: 'Lagos Jazz Night',
    city: 'Lagos',
    venue: 'Civic Hall',
    startsAt: '2027-05-10T18:00:00Z',
  }, organizerId);

  const tier = await events.addTier(event.id, {
    name: 'General',
    priceCents: 1250,
    capacity: 100,
  }, organizerId);

  await events.publishEvent(event.id, organizerId);

  console.log(JSON.stringify({
    eventId: event.id,
    tierId: tier.id,
    capacity: tier.capacity,
  }, null, 2));
  repository.close();
}
