import { mergeSort } from './sorting.js';
import { DomainError } from './errors.js';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

function parseDate(value, field, endOfDay = false) {
  if (typeof value !== 'string') {
    throw new DomainError('VALIDATION', `${field} must be a valid ISO date`);
  }

  const match = ISO_DATE.exec(value);
  if (!match) {
    throw new DomainError('VALIDATION', `${field} must be a valid ISO date`);
  }
  const [, yearText, monthText, dayText, hourText = '00', minuteText = '00', secondText = '00'] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > maxDay ||
      hour > 23 || minute > 59 || second > 59) {
    throw new DomainError('VALIDATION', `${field} must be a valid ISO date`);
  }

  const parsed = value.includes('T') ? new Date(value) : new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new DomainError('VALIDATION', `${field} must be a valid ISO date`);
  }

  if (endOfDay && !value.includes('T')) {
    parsed.setUTCHours(23, 59, 59, 999);
  }
  return parsed;
}

function textIncludes(value, query) {
  return typeof value === 'string' && value.toLowerCase().includes(query);
}

function compareText(a, b) {
  return String(a ?? '').localeCompare(String(b ?? ''));
}

function cheapestTier(summary) {
  const tiers = summary.tiers ?? [];
  if (tiers.length === 0) return undefined;
  return tiers.reduce((cheapest, tier) =>
    tier.priceCents < cheapest.priceCents ? tier : cheapest);
}

function tierSeatsLeft(tier) {
  return tier.seatsLeft ?? (tier.capacity - tier.sold);
}

function totalSeatsLeft(summary) {
  if (summary.seatsLeft !== undefined) return summary.seatsLeft;
  return (summary.tiers ?? []).reduce(
    (total, tier) => total + tierSeatsLeft(tier),
    0,
  );
}

export function filterEvents(summaries, criteria = {}) {
  const {
    q,
    city,
    from,
    to,
    maxPriceCents,
    onlyAvailable,
  } = criteria;

  const normalizedQuery = typeof q === 'string' ? q.toLowerCase() : '';
  const normalizedCity = typeof city === 'string' ? city.toLowerCase() : undefined;
  const fromDate = from === undefined ? undefined : parseDate(from, 'from');
  const toDate = to === undefined ? undefined : parseDate(to, 'to', true);

  if (maxPriceCents !== undefined &&
      (!Number.isInteger(maxPriceCents) || maxPriceCents < 0)) {
    throw new DomainError('VALIDATION', 'maxPriceCents must be a whole number');
  }

  return summaries.filter((summary) => {
    if (normalizedQuery &&
        !textIncludes(summary.title, normalizedQuery) &&
        !textIncludes(summary.venue, normalizedQuery)) return false;
    if (normalizedCity !== undefined &&
        (typeof summary.city !== 'string' ||
         summary.city.toLowerCase() !== normalizedCity)) return false;

    const startsAt = parseDate(summary.startsAt, 'event startsAt');
    if (fromDate && startsAt < fromDate) return false;
    if (toDate && startsAt > toDate) return false;

    if (maxPriceCents !== undefined) {
      const cheapest = cheapestTier(summary);
      if (!cheapest || cheapest.priceCents > maxPriceCents) return false;
    }
    if (onlyAvailable && totalSeatsLeft(summary) <= 0) return false;
    return true;
  });
}

export function sortEvents(summaries, sortBy = 'date') {
  if (!['date', 'price', 'availability'].includes(sortBy)) {
    throw new DomainError('VALIDATION', `Unknown sortBy option: ${sortBy}`);
  }

  const compareDate = (a, b) => {
    const value = parseDate(a.startsAt, 'event startsAt').getTime() -
      parseDate(b.startsAt, 'event startsAt').getTime();
    return value;
  };
  const comparePrice = (a, b) => {
    const aPrice = cheapestTier(a)?.priceCents;
    const bPrice = cheapestTier(b)?.priceCents;
    if (aPrice === undefined && bPrice === undefined) return 0;
    if (aPrice === undefined) return 1;
    if (bPrice === undefined) return -1;
    return aPrice - bPrice;
  };

  return mergeSort(summaries, (a, b) => {
    let primary;
    if (sortBy === 'date') primary = compareDate(a, b);
    if (sortBy === 'price') primary = comparePrice(a, b);
    if (sortBy === 'availability') {
      primary = totalSeatsLeft(b) - totalSeatsLeft(a);
    }
    if (primary !== 0) return primary;
    return compareText(a.title, b.title) || compareText(a.id, b.id);
  });
}

export function searchEvents(summaries, criteria = {}, sortBy = 'date') {
  return sortEvents(filterEvents(summaries, criteria), sortBy);
}
