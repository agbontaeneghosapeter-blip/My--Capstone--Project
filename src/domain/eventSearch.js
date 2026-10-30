import { DomainError } from './errors.js';
import { mergeSort } from './sorting.js';

function parseDate(value, field, endOfDate = false) {
  const match = typeof value === 'string'
    ? /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2}))?$/.exec(value)
    : null;
  if (!match) throw new DomainError('VALIDATION', `${field} must be a valid ISO date`);

  const [, yearText, monthText, dayText, hour, minute, second, , offset] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const daysInMonth = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,
    31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const validDate = month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1];
  const validTime = hour === undefined
    || (Number(hour) <= 23 && Number(minute) <= 59 && Number(second ?? 0) <= 59);
  const validOffset = !offset || offset === 'Z'
    || (Number(offset.slice(1, 3)) <= 23 && Number(offset.slice(4, 6)) <= 59);
  if (!validDate || !validTime || !validOffset) {
    throw new DomainError('VALIDATION', `${field} must be a valid ISO date`);
  }

  if (endOfDate && hour === undefined) {
    return Date.parse(`${value}T23:59:59.999Z`);
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) throw new DomainError('VALIDATION', `${field} must be a valid ISO date`);
  return timestamp;
}

function tiersFor(event) {
  return Array.isArray(event.tiers) ? event.tiers : [];
}

function cheapestPrice(event) {
  const prices = tiersFor(event).map((tier) => tier.priceCents);
  return prices.length === 0 ? undefined : Math.min(...prices);
}

function availableSeats(event) {
  if (!Array.isArray(event.tiers)) return event.availableSeats ?? 0;
  return event.tiers.reduce((total, tier) => {
    const remaining = tier.seatsLeft ?? (tier.capacity - tier.sold);
    return total + remaining;
  }, 0);
}

function compareText(left, right) {
  const a = String(left ?? '');
  const b = String(right ?? '');
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareTitleAndId(left, right) {
  return compareText(left.title, right.title) || compareText(left.id, right.id);
}

export function filterEvents(summaries, {
  q,
  city,
  from,
  to,
  maxPriceCents,
  onlyAvailable,
} = {}) {
  const query = q === undefined ? undefined : String(q).toLowerCase();
  const targetCity = city === undefined ? undefined : String(city).toLowerCase();
  const fromTime = from === undefined ? undefined : parseDate(from, 'from');
  const toTime = to === undefined ? undefined : parseDate(to, 'to', true);
  if (maxPriceCents !== undefined && !Number.isInteger(maxPriceCents)) {
    throw new DomainError('VALIDATION', 'maxPriceCents must be a whole number');
  }

  return summaries.filter((event) => {
    if (query !== undefined
      && !`${event.title ?? ''} ${event.venue ?? ''}`.toLowerCase().includes(query)) return false;
    if (targetCity !== undefined && String(event.city ?? '').toLowerCase() !== targetCity) return false;
    const startsAt = parseDate(event.startsAt, 'event startsAt');
    if (fromTime !== undefined && startsAt < fromTime) return false;
    if (toTime !== undefined && startsAt > toTime) return false;
    if (maxPriceCents !== undefined) {
      const price = cheapestPrice(event);
      if (price === undefined || price > maxPriceCents) return false;
    }
    if (onlyAvailable && availableSeats(event) <= 0) return false;
    return true;
  });
}

export function sortEvents(summaries, sortBy) {
  if (!['date', 'price', 'availability'].includes(sortBy)) {
    throw new DomainError('VALIDATION', `Unknown event sort option: ${sortBy}`);
  }

  const compare = (left, right) => {
    let order = 0;
    if (sortBy === 'date') {
      const leftDay = Math.floor(parseDate(left.startsAt, 'event startsAt') / 86400000);
      const rightDay = Math.floor(parseDate(right.startsAt, 'event startsAt') / 86400000);
      order = leftDay - rightDay;
    } else if (sortBy === 'price') {
      const leftPrice = cheapestPrice(left);
      const rightPrice = cheapestPrice(right);
      if (leftPrice === undefined) order = rightPrice === undefined ? 0 : 1;
      else if (rightPrice === undefined) order = -1;
      else order = leftPrice - rightPrice;
    } else {
      order = availableSeats(right) - availableSeats(left);
    }
    return order || compareTitleAndId(left, right);
  };

  return mergeSort(summaries, compare);
}

export function searchEvents(summaries, criteria, sortBy) {
  return sortEvents(filterEvents(summaries, criteria), sortBy);
}