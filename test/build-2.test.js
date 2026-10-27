import test from 'node:test';
import assert from 'node:assert/strict';

import { DomainError } from '../src/domain/errors.js';
import {
  addTier,
  bookTickets,
  createEvent,
  createStore,
  listEventSummaries,
  publishEvent,
} from '../src/domain/inventory.js';
import { mergeSort } from '../src/domain/sorting.js';
import {
  filterEvents,
  searchEvents,
  sortEvents,
} from '../src/domain/eventSearch.js';

function assertDomainError(code, action) {
  assert.throws(action, (error) => error instanceof DomainError && error.code === code);
}

function summary(overrides = {}) {
  return {
    id: overrides.id ?? 'event-1',
    title: overrides.title ?? 'Event',
    city: overrides.city ?? 'Lagos',
    venue: overrides.venue ?? 'Hall',
    startsAt: overrides.startsAt ?? '2026-12-05T17:00:00.000Z',
    tiers: overrides.tiers ?? [{ priceCents: 500, capacity: 10, sold: 2 }],
  };
}

const validEvent = {
  title: 'An Event', city: 'Lagos', venue: 'Hall',
  startsAt: '2026-12-05T17:00:00.000Z', organizerId: 'organizer-1',
};

test('S02: creates a valid event as a draft and keeps it off the public list', () => {
  const store = createStore();
  const event = createEvent(store, validEvent);
  assert.equal(event.status, 'draft');
  assert.ok(event.id);
  assert.deepEqual(listEventSummaries(store), []);
});

test('S02: rejects missing text or an invalid date without saving', () => {
  const store = createStore();
  const invalidInputs = [
    { ...validEvent, title: '' },
    { ...validEvent, city: '   ' },
    { ...validEvent, startsAt: 'not-a-date' },
  ];
  for (const input of invalidInputs) {
    assertDomainError('VALIDATION', () => createEvent(store, input));
  }
  assert.equal(store.events.size, 0);
});

test('S03: saves a valid tier with no sold seats and the requested capacity', () => {
  const store = createStore();
  const event = createEvent(store, validEvent);
  const tier = addTier(store, event.id, { name: 'General', priceCents: 500000, capacity: 100 });
  assert.equal(tier.priceCents, 500000);
  assert.equal(tier.capacity, 100);
  assert.equal(tier.sold, 0);
  assert.equal(tier.capacity - tier.sold, 100);
});

test('S03: rejects a fractional price or undersized capacity', () => {
  const store = createStore();
  const event = createEvent(store, validEvent);
  assertDomainError('VALIDATION', () => addTier(store, event.id, {
    name: 'Fractional', priceCents: 10.5, capacity: 1,
  }));
  assertDomainError('VALIDATION', () => addTier(store, event.id, {
    name: 'Small', priceCents: 10, capacity: 0,
  }));
});

test('S03: rejects a tier for an event that does not exist', () => {
  const store = createStore();
  assertDomainError('NOT_FOUND', () => addTier(store, 'missing', {
    name: 'General', priceCents: 500, capacity: 10,
  }));
});

test('S04: publishes a drafted event that has a ticket tier', () => {
  const store = createStore();
  const event = createEvent(store, validEvent);
  addTier(store, event.id, { name: 'General', priceCents: 500, capacity: 10 });
  assert.equal(publishEvent(store, event.id), event);
  assert.equal(event.status, 'published');
});

test('S04: rejects publishing a tierless event and leaves it as a draft', () => {
  const store = createStore();
  const event = createEvent(store, validEvent);
  assertDomainError('INVALID_STATE', () => publishEvent(store, event.id));
  assert.equal(event.status, 'draft');
});

test('S04: public event summaries hide drafts', () => {
  const store = createStore();
  const draft = createEvent(store, validEvent);
  const published = createEvent(store, { ...validEvent, title: 'Published' });
  addTier(store, published.id, { name: 'General', priceCents: 500, capacity: 10 });
  publishEvent(store, published.id);
  assert.deepEqual(listEventSummaries(store).map((event) => event.id), [published.id]);
  assert.deepEqual(listEventSummaries(store, { publishedOnly: false }).map((event) => event.id), [draft.id, published.id]);
});

test('S05: searches title or venue text ignoring case', () => {
  const events = [
    summary({ id: 'title', title: 'Lagos Tech Meetup' }),
    summary({ id: 'venue', title: 'Abuja Night', venue: 'JAZZ Arena' }),
    summary({ id: 'none', title: 'Other', venue: 'Other' }),
  ];
  assert.deepEqual(filterEvents(events, { q: 'jAzZ' }).map((event) => event.id), ['venue']);
});

test('S05: filters city exactly and ignoring case', () => {
  const events = [summary({ id: 'lagos', city: 'LAGOS' }), summary({ id: 'abuja', city: 'Abuja' })];
  assert.deepEqual(filterEvents(events, { city: 'lagos' }).map((event) => event.id), ['lagos']);
});

test('S05: max price uses cheapest tier and excludes events without tiers', () => {
  const events = [
    summary({ id: 'expensive', tiers: [{ priceCents: 700 }] }),
    summary({ id: 'cheap', tiers: [{ priceCents: 900 }, { priceCents: 400 }] }),
    summary({ id: 'none', tiers: [] }),
  ];
  assert.deepEqual(searchEvents(events, { maxPriceCents: 500 }, 'price').map((event) => event.id), ['cheap']);
  assert.equal(events[1].tiers[0].priceCents, 900);
});

test('S05: date sorting breaks exact ties by title', () => {
  const events = [
    summary({ id: 'z', title: 'Zulu', startsAt: '2026-12-05T17:00:00.000Z' }),
    summary({ id: 'a', title: 'Alpha', startsAt: '2026-12-05T17:00:00.000Z' }),
  ];
  assert.deepEqual(sortEvents(events, 'date').map((event) => event.id), ['a', 'z']);
});

test('S05: a date-only to includes all events that day', () => {
  const events = [summary({ id: 'late', startsAt: '2026-12-05T23:59:59.999Z' }), summary({ id: 'next', startsAt: '2026-12-06T00:00:00.000Z' })];
  assert.deepEqual(filterEvents(events, { to: '2026-12-05' }).map((event) => event.id), ['late']);
});

test('S05: rejects invalid dates and prices or an unknown sort', () => {
  assertDomainError('VALIDATION', () => filterEvents([], { from: 'not-a-date' }));
  assertDomainError('VALIDATION', () => filterEvents([], { maxPriceCents: 10.5 }));
  assertDomainError('VALIDATION', () => sortEvents([], 'random'));
});

test('S05: filtering and sorting do not mutate an event list', () => {
  const events = [
    summary({ id: 'b', title: 'B', tiers: [{ priceCents: 300, capacity: 0, sold: 0 }] }),
    summary({ id: 'a', title: 'A', tiers: [{ priceCents: 100, capacity: 5, sold: 0 }] }),
  ];
  const snapshot = structuredClone(events);
  const filtered = filterEvents(events, { onlyAvailable: true });
  const sorted = sortEvents(events, 'price');
  assert.notEqual(filtered, events);
  assert.notEqual(sorted, events);
  assert.deepEqual(events, snapshot);
});

test('S05: merge sorting is stable and supports empty lists', () => {
  const first = { id: 'first', title: 'Same', number: 1 };
  const second = { id: 'second', title: 'Same', number: 2 };
  assert.deepEqual(mergeSort([first, second], () => 0), [first, second]);
  assert.deepEqual(mergeSort([], () => 0), []);
  assert.deepEqual(sortEvents([], 'availability'), []);
});

test('S05: availability sorting uses seats left and price sorting leaves no-price events last', () => {
  const events = [
    summary({ id: 'most', title: 'B', tiers: [{ priceCents: 700, capacity: 10, sold: 2 }] }),
    summary({ id: 'least', title: 'C', tiers: [{ priceCents: 400, capacity: 10, sold: 8 }] }),
    summary({ id: 'none', title: 'A', tiers: [] }),
  ];
  assert.deepEqual(sortEvents(events, 'availability').map((event) => event.id), ['most', 'least', 'none']);
  assert.deepEqual(sortEvents(events, 'price').map((event) => event.id), ['least', 'most', 'none']);
});

test('S06: creates a pending booking and decreases seats by quantity', () => {
  const store = createStore();
  const event = createEvent(store, validEvent);
  const tier = addTier(store, event.id, { name: 'General', priceCents: 500, capacity: 3 });
  const booking = bookTickets(store, tier.id, 'attendee-1', 2);
  assert.equal(booking.status, 'pending');
  assert.equal(booking.quantity, 2);
  assert.equal(booking.amountCents, 1000);
  assert.equal(tier.capacity - tier.sold, 1);
});

test('S06: sold-out rejection leaves inventory and bookings unchanged', () => {
  const store = createStore();
  const event = createEvent(store, validEvent);
  const tier = addTier(store, event.id, { name: 'General', priceCents: 500, capacity: 1 });
  tier.sold = 0;
  assertDomainError('SOLD_OUT', () => bookTickets(store, tier.id, 'attendee-1', 2));
  assert.equal(tier.sold, 0);
  assert.equal(store.bookings.size, 0);
});

test('S06: rejects quantity zero, negative, fractional or above ten', () => {
  const store = createStore();
  const event = createEvent(store, validEvent);
  const tier = addTier(store, event.id, { name: 'General', priceCents: 500, capacity: 20 });
  for (const quantity of [0, -1, 1.5, 11]) {
    assertDomainError('VALIDATION', () => bookTickets(store, tier.id, 'attendee-1', quantity));
  }
  assert.equal(tier.sold, 0);
});
