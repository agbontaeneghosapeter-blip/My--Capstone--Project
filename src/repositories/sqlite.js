import { openDatabase } from '../db/connection.js';

function rowToEvent(row) {
  if (!row) return undefined;
  return {
    id: row.id,
    organizerId: row.organizer_id,
    title: row.title,
    city: row.city,
    venue: row.venue,
    startsAt: row.starts_at,
    status: row.status,
  };
}

function rowToTier(row) {
  if (!row) return undefined;
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    priceCents: row.price_cents,
    capacity: row.capacity,
    sold: row.sold,
  };
}

function rowToBooking(row) {
  if (!row) return undefined;
  return {
    id: row.id,
    reference: row.reference,
    userId: row.user_id,
    tierId: row.tier_id,
    quantity: row.quantity,
    amountCents: row.amount_cents,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function createSQLiteRepository({ databasePath } = {}) {
  const database = openDatabase(databasePath);

  const saveEventStatement = database.prepare(`
    INSERT INTO events (id, organizer_id, title, city, venue, starts_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      organizer_id = excluded.organizer_id,
      title = excluded.title,
      city = excluded.city,
      venue = excluded.venue,
      starts_at = excluded.starts_at,
      status = excluded.status
  `);
  const getEventStatement = database.prepare('SELECT * FROM events WHERE id = ?');
  const listEventsStatement = database.prepare('SELECT * FROM events');

  const saveTierStatement = database.prepare(`
    INSERT INTO ticket_tiers (id, event_id, name, price_cents, capacity, sold)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      event_id = excluded.event_id,
      name = excluded.name,
      price_cents = excluded.price_cents,
      capacity = excluded.capacity,
      sold = excluded.sold
  `);
  const getTierStatement = database.prepare('SELECT * FROM ticket_tiers WHERE id = ?');
  const listTiersStatement = database.prepare('SELECT * FROM ticket_tiers WHERE event_id = ?');
  const reserveSeatsStatement = database.prepare(`
    UPDATE ticket_tiers
    SET sold = sold + ?
    WHERE id = ? AND sold + ? <= capacity
  `);

  const saveBookingStatement = database.prepare(`
    INSERT INTO bookings (id, reference, user_id, tier_id, quantity, amount_cents, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      reference = excluded.reference,
      user_id = excluded.user_id,
      tier_id = excluded.tier_id,
      quantity = excluded.quantity,
      amount_cents = excluded.amount_cents,
      status = excluded.status,
      created_at = excluded.created_at
  `);
  const getBookingStatement = database.prepare('SELECT * FROM bookings WHERE reference = ?');

  return {
    async saveEvent(event) {
      database.prepare('INSERT INTO users (id, created_at) VALUES (?, ?) ON CONFLICT(id) DO NOTHING')
        .run(event.organizerId, new Date().toISOString());
      saveEventStatement.run(
        event.id,
        event.organizerId,
        event.title,
        event.city,
        event.venue,
        event.startsAt,
        event.status,
      );
      return event;
    },

    async getEvent(id) {
      return rowToEvent(getEventStatement.get(id));
    },

    async listEvents() {
      return listEventsStatement.all().map(rowToEvent);
    },

    async saveTier(tier) {
      saveTierStatement.run(
        tier.id,
        tier.eventId,
        tier.name,
        tier.priceCents,
        tier.capacity,
        tier.sold,
      );
      return tier;
    },

    async getTier(id) {
      return rowToTier(getTierStatement.get(id));
    },

    async reserveSeats(tierId, quantity) {
      const result = reserveSeatsStatement.run(quantity, tierId, quantity);
      return result.changes === 1;
    },

    async listTiersForEvent(eventId) {
      return listTiersStatement.all(eventId).map(rowToTier);
    },

    async saveBooking(booking) {
      database.prepare('INSERT INTO users (id, created_at) VALUES (?, ?) ON CONFLICT(id) DO NOTHING')
        .run(booking.userId, new Date().toISOString());
      saveBookingStatement.run(
        booking.id,
        booking.reference,
        booking.userId,
        booking.tierId,
        booking.quantity,
        booking.amountCents,
        booking.status,
        booking.createdAt,
      );
      return booking;
    },

    async getBookingByReference(reference) {
      return rowToBooking(getBookingStatement.get(reference));
    },

    close() {
      database.close();
    },

    database,
  };
}
