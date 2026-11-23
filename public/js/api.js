import mockEvents from './mockData.js';

const HOLD_SECONDS = 10 * 60;
const bookingsByReference = new Map();

function delay(value, milliseconds = 150) {
  return new Promise((resolve) => {
    globalThis.setTimeout(() => resolve(value), milliseconds);
  });
}

function apiError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.error = { code, message };
  return error;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function recalculateSeats(event) {
  for (const tier of event.tiers) {
    tier.seatsLeft = tier.capacity - tier.sold;
  }
}

function availableSeats(event) {
  return event.tiers.reduce((total, tier) => total + tier.seatsLeft, 0);
}

export function listEvents(criteria = {}) {
  const sortBy = criteria.sortBy ?? 'date';
  if (!['date', 'price', 'availability'].includes(sortBy)) {
    return Promise.reject(apiError('VALIDATION', 'Unknown event sort option'));
  }
  if (criteria.maxPriceCents !== undefined
    && (!Number.isSafeInteger(criteria.maxPriceCents) || criteria.maxPriceCents < 0)) {
    return Promise.reject(apiError('VALIDATION', 'maxPriceCents must be a whole number'));
  }

  let results = mockEvents
    .filter((event) => event.status === 'published')
    .map((event) => {
      recalculateSeats(event);
      return clone(event);
    });

  if (criteria.q) {
    const query = String(criteria.q).toLowerCase();
    results = results.filter((event) =>
      `${event.title} ${event.venue}`.toLowerCase().includes(query));
  }
  if (criteria.city) {
    const city = String(criteria.city).toLowerCase();
    results = results.filter((event) => event.city.toLowerCase() === city);
  }
  if (criteria.maxPriceCents !== undefined) {
    results = results.filter((event) => {
      const prices = event.tiers.map((tier) => tier.priceCents);
      return prices.length > 0 && Math.min(...prices) <= criteria.maxPriceCents;
    });
  }

  if (sortBy === 'price') {
    results.sort((a, b) => Math.min(...a.tiers.map((tier) => tier.priceCents))
      - Math.min(...b.tiers.map((tier) => tier.priceCents)));
  } else if (sortBy === 'availability') {
    results.sort((a, b) => availableSeats(b) - availableSeats(a));
  } else {
    results.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  }
  return delay(results);
}

export function getEvent(id) {
  const event = mockEvents.find((item) => item.id === id);
  if (!event) {
    return Promise.reject(apiError('NOT_FOUND', 'Event not found'));
  }
  recalculateSeats(event);
  return delay(clone(event));
}

export function createBooking({ tierId, quantity }) {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) {
    return Promise.reject(apiError('VALIDATION', 'quantity must be between 1 and 10'));
  }

  for (const event of mockEvents) {
    const tier = event.tiers.find((item) => item.id === tierId);
    if (!tier) continue;
    const seatsLeft = tier.capacity - tier.sold;
    if (seatsLeft === 0) {
      return Promise.reject(apiError('SOLD_OUT', `${tier.name} is sold out`));
    }
    if (quantity > seatsLeft) {
      return Promise.reject(apiError('SOLD_OUT', `Only ${seatsLeft} ticket(s) left in ${tier.name}`));
    }

    tier.sold += quantity;
    tier.seatsLeft = tier.capacity - tier.sold;
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let reference = '';
    for (let index = 0; index < 8; index += 1) {
      reference += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    const booking = {
      id: `booking-${reference}`,
      reference,
      tierId,
      quantity,
      amountCents: tier.priceCents * quantity,
      status: 'pending',
      createdAt: new Date().toISOString(),
      holdSeconds: HOLD_SECONDS,
    };
    bookingsByReference.set(reference, booking);
    return delay(booking);
  }
  return Promise.reject(apiError('NOT_FOUND', 'Ticket tier not found'));
}

export function pay(reference, { decline = false } = {}) {
  const booking = bookingsByReference.get(reference);
  if (!booking) {
    return Promise.reject(apiError('NOT_FOUND', 'Booking not found'));
  }
  if (booking.status === 'paid') {
    return Promise.reject(apiError('INVALID_TRANSITION', 'This booking is already paid'));
  }
  if (decline) {
    return Promise.reject(apiError('PAYMENT_DECLINED', 'Payment was declined'));
  }
  booking.status = 'paid';
  return delay(clone(booking));
}
