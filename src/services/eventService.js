import { DomainError } from '../domain/errors.js';
import { searchEvents } from '../domain/eventSearch.js';
import { newId } from '../domain/ids.js';
import { parseIsoDate, seatsLeft } from '../domain/inventory.js';

function requireObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new DomainError('VALIDATION', `${label} must be an object`);
  }
  return value;
}

function requireText(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainError('VALIDATION', `${field} is required`);
  }
  return value.trim();
}

function requireUserId(value) {
  return requireText(value, 'x-user-id header');
}

function requireEventOrganizer(event, userId) {
  if (event.organizerId !== userId) {
    throw new DomainError('FORBIDDEN', 'Only the event organizer can change this event');
  }
}

function requireWholeNumber(value, field, minimum) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new DomainError('VALIDATION', `${field} must be a whole number of at least ${minimum}`);
  }
  return value;
}

export function createEventService(repository) {
  return {
    async createEvent(input, userId) {
      const body = requireObject(input, 'Event');
      const organizerId = requireUserId(userId);
      const startsAt = parseIsoDate(body.startsAt, 'startsAt').toISOString();
      if (body.venue !== undefined && typeof body.venue !== 'string') {
        throw new DomainError('VALIDATION', 'Venue must be text');
      }
      const venue = (body.venue ?? '').trim();
      const event = {
        id: newId(),
        organizerId,
        title: requireText(body.title, 'Title'),
        city: requireText(body.city, 'City'),
        venue,
        startsAt,
        status: 'draft',
      };
      return repository.saveEvent(event);
    },

    async addTier(eventId, input, userId) {
      const body = requireObject(input, 'Ticket tier');
      const organizerId = requireUserId(userId);
      const event = await repository.getEvent(eventId);
      if (!event) throw new DomainError('NOT_FOUND', 'Event not found');
      requireEventOrganizer(event, organizerId);

      const tier = {
        id: newId(),
        eventId,
        name: requireText(body.name, 'Tier name'),
        priceCents: requireWholeNumber(body.priceCents, 'priceCents', 0),
        capacity: requireWholeNumber(body.capacity, 'capacity', 1),
        sold: 0,
      };
      return repository.saveTier(tier);
    },

    async publishEvent(eventId, userId) {
      const organizerId = requireUserId(userId);
      const event = await repository.getEvent(eventId);
      if (!event) throw new DomainError('NOT_FOUND', 'Event not found');
      requireEventOrganizer(event, organizerId);
      const tiers = await repository.listTiersForEvent(eventId);
      if (tiers.length === 0) {
        throw new DomainError('INVALID_STATE', 'An event needs at least one ticket tier before it can be published');
      }
      event.status = 'published';
      return repository.saveEvent(event);
    },

    async listEvents(criteria, sortBy = 'date') {
      const allEvents = await repository.listEvents();
      const publishedEvents = allEvents.filter((event) => event.status === 'published');
      const summaries = await Promise.all(publishedEvents.map(async (event) => {
        const tiers = await repository.listTiersForEvent(event.id);
        return {
          ...event,
          tiers: tiers.map((tier) => ({ ...tier, seatsLeft: seatsLeft(tier) })),
        };
      }));
      return searchEvents(summaries, criteria, sortBy);
    },
  };
}
