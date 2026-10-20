import { createStore, createEvent, addTier, bookTickets, findBookingByReference } from '../src/domain/inventory.js';

const BOOKINGS = 100_000;
const LOOKUPS = 500;

const store = createStore();
const event = createEvent(store, { title: 'Benchmark', city: 'Lagos', startsAt: '2026-12-05T18:00:00Z', organizerId: 'organizer-1' });
const tier = addTier(store, event.id, { name: 'GA', priceCents: 100, capacity: BOOKINGS });
for (let i = 0; i < BOOKINGS; i++) {
  bookTickets(store, tier.id, `person-${i}`, 1);
}

const list = [...store.bookings.values()];            // the "array" way
const targets = Array.from({ length: LOOKUPS }, () =>
  list[Math.floor(Math.random() * list.length)].reference);

function time(label, fn) {
  const start = performance.now();
  for (const ref of targets) {
    if (!fn(ref)) throw new Error('lookup failed');
  }
  const ms = performance.now() - start;
  console.log(`${label.padEnd(12)} ${ms.toFixed(2).padStart(10)} ms`);
  return ms;
}

console.log(`${LOOKUPS} lookups among ${BOOKINGS.toLocaleString()} bookings\n`);
const arrayMs = time('Array.find', (ref) => list.find((b) => b.reference === ref)); // O(n) each
const mapMs = time('Map.get', (ref) => findBookingByReference(store, ref));          // O(1) each
console.log(`\nMap was about ${Math.round(arrayMs / Math.max(mapMs, 0.001)).toLocaleString()}x faster.`);
