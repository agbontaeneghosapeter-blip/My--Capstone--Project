import { DomainError } from '../domain/errors.js';
import { createBookingService } from '../services/bookingService.js';
import { createEventService } from '../services/eventService.js';
import { Router } from './router.js';

function requireQueryInteger(value, name) {
  if (!/^-?\d+$/.test(value)) {
    throw new DomainError('VALIDATION', `${name} must be a whole number`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new DomainError('VALIDATION', `${name} must be a whole number`);
  }
  return parsed;
}

function parseSearchCriteria(searchParams) {
  const criteria = {};
  for (const name of ['q', 'city', 'from', 'to']) {
    const value = searchParams.get(name);
    if (value !== null) criteria[name] = value;
  }

  const maxPriceCents = searchParams.get('maxPriceCents');
  if (maxPriceCents !== null) {
    criteria.maxPriceCents = requireQueryInteger(maxPriceCents, 'maxPriceCents');
  }

  const onlyAvailable = searchParams.get('onlyAvailable');
  if (onlyAvailable !== null) {
    if (onlyAvailable !== 'true' && onlyAvailable !== 'false') {
      throw new DomainError('VALIDATION', 'onlyAvailable must be true or false');
    }
    criteria.onlyAvailable = onlyAvailable === 'true';
  }
  return criteria;
}

function created(body) {
  return { statusCode: 201, body };
}

export function createApiRouter({ repository, paymentGateway }) {
  const events = createEventService(repository);
  const bookings = createBookingService(repository, paymentGateway);

  return new Router()
    .add('POST', '/api/events', ({ request, body }) => (
      events.createEvent(body, request.headers['x-user-id']).then(created)
    ))
    .add('POST', '/api/events/:id/tiers', ({ request, params, body }) => (
      events.addTier(params.id, body, request.headers['x-user-id']).then(created)
    ))
    .add('POST', '/api/events/:id/publish', ({ request, params }) => (
      events.publishEvent(params.id, request.headers['x-user-id'])
    ))
    .add('GET', '/api/events', ({ request }) => {
      const url = new URL(request.url, 'http://localhost');
      const sortBy = url.searchParams.get('sortBy') ?? 'date';
      return events.listEvents(parseSearchCriteria(url.searchParams), sortBy);
    })
    .add('POST', '/api/bookings', ({ request, body }) => (
      bookings.createBooking(body, request.headers['x-user-id']).then(created)
    ))
    .add('POST', '/api/bookings/:reference/pay', ({ request, params, body }) => {
      if (body !== undefined && (body === null || typeof body !== 'object' || Array.isArray(body))) {
        throw new DomainError('VALIDATION', 'Payment request must be an object');
      }
      if (body?.decline !== undefined && typeof body.decline !== 'boolean') {
        throw new DomainError('VALIDATION', 'decline must be true or false');
      }
      return bookings.payBooking(params.reference, request.headers['x-user-id'], {
        shouldDecline: body?.decline ?? false,
      });
    })
    .add('POST', '/api/bookings/:reference/cancel', ({ request, params }) => (
      bookings.cancelBooking(params.reference, request.headers['x-user-id'])
    ));
}
