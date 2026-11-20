import { DomainError } from '../domain/errors.js';
import { assertTransition } from '../domain/bookingStateMachine.js';
import { newId, referenceCode } from '../domain/ids.js';
import { MAX_TICKETS_PER_BOOKING, seatsLeft } from '../domain/inventory.js';

function requireObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new DomainError('VALIDATION', `${label} must be an object`);
  }
  return value;
}

function requireUserId(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainError('VALIDATION', 'x-user-id header is required');
  }
  return value.trim();
}

function requireBookingOwner(booking, userId) {
  if (booking.userId !== userId) {
    throw new DomainError('FORBIDDEN', 'Only the attendee who made this booking can change it');
  }
}

export function createBookingService(repository, paymentGateway) {
  return {
    async createBooking(input, userId) {
      const body = requireObject(input, 'Booking');
      const attendeeId = requireUserId(userId);
      const tierId = typeof body.tierId === 'string' && body.tierId.trim() !== ''
        ? body.tierId.trim()
        : undefined;
      if (tierId === undefined) {
        throw new DomainError('VALIDATION', 'tierId is required');
      }
      const tier = await repository.getTier(tierId);
      if (!tier) throw new DomainError('NOT_FOUND', 'Ticket tier not found');
      const event = await repository.getEvent(tier.eventId);
      if (!event) throw new DomainError('NOT_FOUND', 'Event not found');
      if (event.status !== 'published') {
        throw new DomainError('INVALID_STATE', 'Tickets can only be booked for a published event');
      }
      if (!Number.isSafeInteger(body.quantity)
        || body.quantity < 1 || body.quantity > MAX_TICKETS_PER_BOOKING) {
        throw new DomainError(
          'VALIDATION',
          `quantity must be between 1 and ${MAX_TICKETS_PER_BOOKING}`,
        );
      }

      const left = seatsLeft(tier);
      if (left < body.quantity) {
        const message = left === 0
          ? `${tier.name} is sold out`
          : `Only ${left} ticket(s) left in ${tier.name}`;
        throw new DomainError('SOLD_OUT', message, { seatsLeft: left });
      }
      const amountCents = tier.priceCents * body.quantity;
      if (!Number.isSafeInteger(amountCents)) {
        throw new DomainError('VALIDATION', 'Booking amount exceeds the supported whole-cent range');
      }

      let reference;
      do {
        reference = referenceCode();
      } while (await repository.getBookingByReference(reference));

      const reserved = await repository.reserveSeats(tier.id, body.quantity);
      if (!reserved) {
        throw new DomainError('SOLD_OUT', 'The requested seats are no longer available');
      }
      return repository.saveBooking({
        id: newId(),
        reference,
        userId: attendeeId,
        tierId: tier.id,
        quantity: body.quantity,
        amountCents,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
    },

    async payBooking(reference, userId, { shouldDecline = false } = {}) {
      const attendeeId = requireUserId(userId);
      const booking = await repository.getBookingByReference(reference);
      if (!booking) throw new DomainError('NOT_FOUND', 'Booking not found');
      requireBookingOwner(booking, attendeeId);
      assertTransition(booking.status, 'paid');

      const charge = await paymentGateway.charge({
        amountCents: booking.amountCents,
        shouldDecline,
      });
      if (charge.status === 'declined') {
        throw new DomainError('PAYMENT_DECLINED', 'Payment was declined');
      }
      if (charge.status !== 'succeeded') {
        throw new Error('Payment gateway returned an unknown result');
      }

      booking.status = 'paid';
      return repository.saveBooking(booking);
    },

    async cancelBooking(reference, userId) {
      const attendeeId = requireUserId(userId);
      const booking = await repository.getBookingByReference(reference);
      if (!booking) throw new DomainError('NOT_FOUND', 'Booking not found');
      requireBookingOwner(booking, attendeeId);
      if (booking.status !== 'pending') {
        throw new DomainError('INVALID_TRANSITION', `Cannot cancel a ${booking.status} booking in this build`);
      }
      assertTransition(booking.status, 'cancelled');

      const tier = await repository.getTier(booking.tierId);
      if (!tier) throw new DomainError('NOT_FOUND', 'Ticket tier not found');
      tier.sold -= booking.quantity;
      booking.status = 'cancelled';
      await repository.saveTier(tier);
      return repository.saveBooking(booking);
    },
  };
}
