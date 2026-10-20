import {
  createStore, createEvent, addTier, bookTickets, cancelBooking,
  findBookingByReference, joinWaitlist, offerNextOnWaitlist, seatsLeft,
} from '../src/domain/inventory.js';
import { DomainError } from '../src/domain/errors.js';

const store = createStore();
const event = createEvent(store, {
  title: 'Lagos Tech Meetup',
  city: 'Lagos',
  startsAt: '2026-12-05T18:00:00Z',
  organizerId: 'organizer-1',
});
const tier = addTier(store, event.id, { name: 'General', priceCents: 500_000, capacity: 3 });
console.log(`Created "${event.title}" with ${tier.capacity} seats in ${tier.name}.\n`);

// Runs an action, prints OK or FAIL (with the error code), and returns the result.
function attempt(label, action) {
  try {
    const result = action();
    console.log(`OK    ${label}`);
    return result;
  } catch (err) {
    if (!(err instanceof DomainError)) throw err;
    console.log(`FAIL  ${label} -> ${err.code}: ${err.message}`);
    return null;
  }
}

const ada = attempt('Ada books 2 tickets', () => bookTickets(store, tier.id, 'ada', 2));
attempt('Bayo books 2 tickets (only 1 left)', () => bookTickets(store, tier.id, 'bayo', 2));
attempt('Bayo books 1 ticket', () => bookTickets(store, tier.id, 'bayo', 1));
console.log(`\nSeats left: ${seatsLeft(tier)}\n`);

attempt('Chidi joins the waitlist for 2 seats', () => joinWaitlist(store, tier.id, 'chidi', 2));
attempt('Dayo joins the waitlist for 1 seat', () => joinWaitlist(store, tier.id, 'dayo', 1));

console.log(`\nLooking Ada's booking up by reference ${ada.reference}:`);
console.log(findBookingByReference(store, ada.reference));

console.log('');
attempt('Ada cancels', () => cancelBooking(store, ada.reference));
console.log(`Seats left: ${seatsLeft(tier)}`);
console.log('Next on the waitlist:', offerNextOnWaitlist(store, tier.id));

console.log('');
attempt('Ada cancels again', () => cancelBooking(store, ada.reference));
