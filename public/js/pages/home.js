import { listEvents } from '../api.js';
import { el, formatPriceCents } from '../ui.js';

const app = document.querySelector('#app');

function eventCard(event) {
  const earliestPrice = Math.min(...event.tiers.map((tier) => tier.priceCents));
  const seatsLeft = event.tiers.reduce((total, tier) => total + tier.seatsLeft, 0);
  const date = new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(event.startsAt));

  return el('article', { className: 'event-card' }, [
    el('div', { className: 'event-card-body' }, [
      el('p', { className: 'event-city', text: event.city }),
      el('h2', {}, [el('a', { href: `/event.html?id=${encodeURIComponent(event.id)}`, text: event.title })]),
      el('p', { className: 'event-venue', text: event.venue }),
      el('p', { className: 'event-date', text: date }),
      el('p', { className: 'event-price', text: `From ${formatPriceCents(earliestPrice)}` }),
      el('p', {
        className: seatsLeft > 0 ? 'event-availability' : 'event-availability sold-out-label',
        text: seatsLeft > 0 ? `${seatsLeft} seats left` : 'Sold out',
      }),
    ]),
  ]);
}

function renderEvents(events) {
  const grid = app.querySelector('#event-grid');
  grid.replaceChildren();
  if (events.length === 0) {
    grid.appendChild(el('p', { className: 'empty-state', text: 'No events match these filters.' }));
    return;
  }
  for (const event of events) {
    grid.appendChild(eventCard(event));
  }
}

async function loadEvents() {
  const search = document.querySelector('#event-search');
  const city = document.querySelector('#city-filter');
  const maximum = document.querySelector('#maximum-price');
  const sort = document.querySelector('#sort-events');

  const maxValue = maximum.value.trim();
  const criteria = {
    q: search.value.trim() || undefined,
    city: city.value || undefined,
    maxPriceCents: maxValue === '' ? undefined : Number(maxValue),
    sortBy: sort.value,
  };

  try {
    const events = await listEvents(criteria);
    renderEvents(events);
  } catch (error) {
    app.querySelector('#event-grid').replaceChildren(
      el('p', { className: 'error-message', text: error.message || 'Could not load events.' }),
    );
  }
}

const heading = el('h1', { text: 'Discover events' });
const controls = el('form', { className: 'filter-panel', id: 'event-filters' }, [
  el('div', { className: 'form-field' }, [
    el('label', { for: 'event-search', text: 'Search events' }),
    el('input', { id: 'event-search', name: 'q', type: 'search', placeholder: 'Title or venue' }),
  ]),
  el('div', { className: 'form-field' }, [
    el('label', { for: 'city-filter', text: 'City' }),
    el('select', { id: 'city-filter', name: 'city' }, [
      el('option', { value: '', text: 'All cities' }),
      el('option', { value: 'Lagos', text: 'Lagos' }),
      el('option', { value: 'Abuja', text: 'Abuja' }),
      el('option', { value: 'Port Harcourt', text: 'Port Harcourt' }),
      el('option', { value: 'Ibadan', text: 'Ibadan' }),
    ]),
  ]),
  el('div', { className: 'form-field' }, [
    el('label', { for: 'maximum-price', text: 'Maximum price (whole cents)' }),
    el('input', { id: 'maximum-price', name: 'maxPriceCents', type: 'number', min: '0', step: '1', placeholder: 'e.g. 250000' }),
  ]),
  el('div', { className: 'form-field' }, [
    el('label', { for: 'sort-events', text: 'Sort by' }),
    el('select', { id: 'sort-events', name: 'sortBy' }, [
      el('option', { value: 'date', text: 'Date' }),
      el('option', { value: 'price', text: 'Price: low to high' }),
      el('option', { value: 'availability', text: 'Most available' }),
    ]),
  ]),
]);

controls.addEventListener('submit', (event) => {
  event.preventDefault();
  loadEvents();
});
controls.addEventListener('input', () => loadEvents());
controls.addEventListener('change', () => loadEvents());

app.append(
  heading,
  controls,
  el('section', { id: 'event-grid', className: 'event-grid', 'aria-label': 'Events' }),
);
loadEvents();
