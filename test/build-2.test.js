import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  addTier,
  bookTickets,
  createEvent,
  createStore,
  listEventSummaries,
  publishEvent,
  seatsLeft,
  unpublishEvent,
} from '../src/domain/inventory.js';
import { DomainError } from '../src/domain/errors.js';
import { filterEvents, searchEvents, sortEvents } from '../src/domain/eventSearch.js';
import { mergeSort } from '../src/domain/sorting.js';

function expectCode(code, action) {
  assert.throws(action, (error) => error instanceof DomainError && error.code === code);
}

function eventFixture(store, overrides = {}) {
  return createEvent(store, {
    title: 'Lagos Tech Meetup',
    city: 'Lagos',
    venue: 'Civic Hall',
    startsAt: '2026-12-05T17:00:00Z',
    organizerId: 'organizer-1',
    ...overrides,
  });
}

function publishedEvent(store, overrides = {}, tiers = [{ name: 'General', priceCents: 500000, capacity: 100 }]) {
  const event = eventFixture(store, overrides);
  for (const tier of tiers) addTier(store, event.id, tier);
  publishEvent(store, event.id);
  return event;
}

function summary(id, title, startsAt, prices = [], remainingSeats = 0, overrides = {}) {
  return {
    id,
    title,
    city: 'Lagos',
    venue: 'Civic Hall',
    startsAt,
    tiers: prices.map((priceCents, index) => ({
      id: `${id}-tier-${index}`,
      priceCents,
      seatsLeft: remainingSeats,
    })),
    ...overrides,
  };
}

describe('inventory', () => {
test('S02: creates a new draft event hidden from the public list', () => {
  const store = createStore();
  const event = eventFixture(store);
  assert.equal(event.status, 'draft');
  assert.ok(event.id);
  assert.equal(event.title, 'Lagos Tech Meetup');
  assert.equal(event.city, 'Lagos');
  assert.equal(event.venue, 'Civic Hall');
  assert.equal(event.startsAt, '2026-12-05T17:00:00.000Z');
  assert.deepEqual(listEventSummaries(store), []);
  assert.equal(listEventSummaries(store, { publishedOnly: false })[0].id, event.id);
});

test('S02: rejects missing title or city and impossible dates without saving', () => {
  for (const overrides of [
    { title: '' },
    { city: '  ' },
    { startsAt: '2026-02-30T17:00:00Z' },
  ]) {
    const store = createStore();
    expectCode('VALIDATION', () => eventFixture(store, overrides));
    assert.equal(store.events.size, 0);
  }
});

test('S03: adds a tier with zero sold and the requested capacity and price', () => {
  const store = createStore();
  const event = eventFixture(store);
  const tier = addTier(store, event.id, { name: 'General', priceCents: 500000, capacity: 100 });
  assert.equal(tier.name, 'General');
  assert.equal(tier.priceCents, 500000);
  assert.equal(tier.sold, 0);
  assert.equal(seatsLeft(tier), 100);
});

test('S03: rejects fractional prices and capacities below one', () => {
  const store = createStore();
  const event = eventFixture(store);
  expectCode('VALIDATION', () => addTier(store, event.id, { name: 'General', priceCents: 1.5, capacity: 10 }));
  expectCode('VALIDATION', () => addTier(store, event.id, { name: 'General', priceCents: 100, capacity: 0 }));
  assert.equal(store.tiers.size, 0);
});

test('S03: rejects a tier for an event that does not exist', () => {
  expectCode('NOT_FOUND', () => addTier(createStore(), 'missing', {
    name: 'General', priceCents: 100, capacity: 10,
  }));
});

test('S04: publishing a tiered draft exposes it in the public list', () => {
  const store = createStore();
  const event = eventFixture(store);
  addTier(store, event.id, { name: 'General', priceCents: 100, capacity: 10 });
  assert.equal(publishEvent(store, event.id).status, 'published');
  assert.equal(listEventSummaries(store)[0].id, event.id);
});

test('S04: publishing without ticket tiers fails and leaves the event a draft', () => {
  const store = createStore();
  const event = eventFixture(store);
  expectCode('INVALID_STATE', () => publishEvent(store, event.id));
  assert.equal(event.status, 'draft');
  assert.deepEqual(listEventSummaries(store), []);
});

test('S04: unpublishing hides the event from public summaries', () => {
  const store = createStore();
  const event = publishedEvent(store);
  assert.equal(unpublishEvent(store, event.id).status, 'draft');
  assert.deepEqual(listEventSummaries(store), []);
  assert.equal(listEventSummaries(store, { publishedOnly: false })[0].id, event.id);
});

test('S04: publishing and unpublishing an unknown event fail with NOT_FOUND', () => {
  const store = createStore();
  expectCode('NOT_FOUND', () => publishEvent(store, 'missing'));
  expectCode('NOT_FOUND', () => unpublishEvent(store, 'missing'));
});
});

describe('event search', () => {
test('S05: searches title and venue case-insensitively', () => {
  const events = [
    summary('lagos', 'Lagos Tech Meetup', '2026-12-05T17:00:00Z'),
    summary('abuja', 'Abuja Evening', '2026-12-06T17:00:00Z', [], 0, { venue: 'Jazz Hall' }),
  ];
  assert.deepEqual(filterEvents(events, { q: 'JAZZ' }).map((event) => event.id), ['abuja']);
});

test('S05: filters city case-insensitively but matches the full city', () => {
  const events = [
    summary('lagos', 'Lagos One', '2026-12-05T17:00:00Z'),
    summary('abuja', 'Abuja One', '2026-12-05T17:00:00Z', [], 0, { city: 'Abuja' }),
    summary('lagos-2', 'Lagos Two', '2026-12-05T17:00:00Z', [], 0, { city: 'Greater Lagos' }),
  ];
  assert.deepEqual(filterEvents(events, { city: 'lAgOs' }).map((event) => event.id), ['lagos']);
});

test('S05: filters by cheapest tier price and sorts low to high, excluding events without tiers', () => {
  const events = [
    summary('expensive', 'Expensive', '2026-12-05T17:00:00Z', [900, 600]),
    summary('cheap', 'Cheap', '2026-12-05T17:00:00Z', [300, 500]),
    summary('none', 'No tiers', '2026-12-05T17:00:00Z'),
  ];
  assert.deepEqual(searchEvents(events, { maxPriceCents: 600 }, 'price').map((event) => event.id), ['cheap', 'expensive']);
  assert.deepEqual(sortEvents(events, 'price').map((event) => event.id), ['cheap', 'expensive', 'none']);
});

test('S05: sorts by date and breaks same-day ties by title then id', () => {
  const events = [
    summary('z', 'Zulu', '2026-12-05T08:00:00Z'),
    summary('later', 'Earlier title', '2026-12-06T09:00:00Z'),
    summary('b', 'Alpha', '2026-12-05T17:00:00Z'),
    summary('a', 'Alpha', '2026-12-05T17:00:00Z'),
  ];
  assert.deepEqual(sortEvents(events, 'date').map((event) => event.id), ['a', 'b', 'z', 'later']);
});

test('S05: includes an event throughout the inclusive date-only end date', () => {
  const event = summary('evening', 'Evening Event', '2026-12-05T17:00:00Z');
  assert.deepEqual(filterEvents([event], { from: '2026-12-05', to: '2026-12-05' }), [event]);
});

test('S05: supports availability sorting and only-available filtering', () => {
  const events = [
    summary('few', 'Few Seats', '2026-12-05T17:00:00Z', [100], 1),
    summary('many', 'Many Seats', '2026-12-05T17:00:00Z', [100], 5),
    summary('none', 'Sold Out', '2026-12-05T17:00:00Z', [100], 0),
  ];
  assert.deepEqual(sortEvents(events, 'availability').map((event) => event.id), ['many', 'few', 'none']);
  assert.deepEqual(filterEvents(events, { onlyAvailable: true }).map((event) => event.id), ['few', 'many']);
});

test('S05: rejects invalid dates, fractional prices, and unknown sorts with VALIDATION', () => {
  const events = [summary('valid', 'Valid', '2026-12-05T17:00:00Z')];
  expectCode('VALIDATION', () => filterEvents(events, { from: '2026-02-30' }));
  expectCode('VALIDATION', () => filterEvents(events, { maxPriceCents: 10.5 }));
  expectCode('VALIDATION', () => sortEvents(events, 'random'));
});

test('S05: filtering and sorting return new lists without changing the source', () => {
  const events = [
    summary('b', 'B Event', '2026-12-06T17:00:00Z'),
    summary('a', 'A Event', '2026-12-05T17:00:00Z'),
  ];
  const original = [...events];
  const filtered = filterEvents(events, { city: 'Lagos' });
  const sorted = sortEvents(events, 'date');
  assert.notStrictEqual(filtered, events);
  assert.notStrictEqual(sorted, events);
  assert.deepEqual(events, original);
});

test('S05: empty event lists remain empty through filtering, sorting, and searching', () => {
  assert.deepEqual(filterEvents([], { q: 'event' }), []);
  assert.deepEqual(sortEvents([], 'date'), []);
  assert.deepEqual(searchEvents([], {}, 'price'), []);
});
});

describe('booking', () => {
test('S06: booking creates a pending booking for the requested quantity and cents', () => {
  const store = createStore();
  const event = eventFixture(store);
  const tier = addTier(store, event.id, { name: 'General', priceCents: 125, capacity: 3 });
  publishEvent(store, event.id);
  const booking = bookTickets(store, tier.id, 'attendee-1', 2);
  assert.equal(booking.status, 'pending');
  assert.equal(booking.quantity, 2);
  assert.equal(booking.amountCents, 250);
  assert.equal(seatsLeft(tier), 1);
});

test('S06: rejects an oversell without changing seats or bookings', () => {
  const store = createStore();
  const event = eventFixture(store);
  const tier = addTier(store, event.id, { name: 'General', priceCents: 125, capacity: 1 });
  publishEvent(store, event.id);
  expectCode('SOLD_OUT', () => bookTickets(store, tier.id, 'attendee-1', 2));
  assert.equal(seatsLeft(tier), 1);
  assert.equal(store.bookings.size, 0);
});

test('S06: rejects zero, negative, fractional, and over-limit quantities', () => {
  const store = createStore();
  const event = eventFixture(store);
  const tier = addTier(store, event.id, { name: 'General', priceCents: 125, capacity: 20 });
  for (const quantity of [0, -1, 1.5, 11]) {
    expectCode('VALIDATION', () => bookTickets(store, tier.id, 'attendee-1', quantity));
  }
  assert.equal(seatsLeft(tier), 20);
  assert.equal(store.bookings.size, 0);
});
});

describe('mergeSort', () => {
test('merge sort returns a stable new array and leaves its input untouched', () => {
  const values = [
    { key: 2, order: 'first' },
    { key: 1, order: 'middle' },
    { key: 2, order: 'last' },
  ];
  const sorted = mergeSort(values, (left, right) => left.key - right.key);
  assert.notStrictEqual(sorted, values);
  assert.deepEqual(sorted.map((item) => item.order), ['middle', 'first', 'last']);
  assert.deepEqual(values.map((item) => item.order), ['first', 'middle', 'last']);
});
});