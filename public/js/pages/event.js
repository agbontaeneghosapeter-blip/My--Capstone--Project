import { createBooking, getEvent, pay } from '../api.js';
import { el, formatPriceCents } from '../ui.js';

const app = document.querySelector('#app');
const eventId = new URLSearchParams(window.location.search).get('id');
let activeBooking = null;
let countdownTimer = null;

function formatDate(startsAt) {
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(startsAt));
}

function showMessage(container, message, className = 'error-message') {
  container.replaceChildren(el('p', { className, text: message }));
}

function renderTier(tier) {
  const soldOut = tier.seatsLeft <= 0;
  const limit = soldOut ? 0 : Math.min(10, tier.seatsLeft);
  const tierRow = el('article', {
    className: soldOut ? 'tier-card tier-sold-out' : 'tier-card',
  });

  const details = el('div', {}, [
    el('h3', { text: tier.name }),
    el('p', { className: 'tier-price', text: formatPriceCents(tier.priceCents) }),
    el('p', { className: soldOut ? 'sold-out-label' : 'seats-left',
      text: soldOut ? 'Sold out' : `${tier.seatsLeft} seat(s) left` }),
  ]);

  const quantityField = el('div', { className: 'form-field quantity-field' }, [
    el('label', { for: `quantity-${tier.id}`, text: `Quantity for ${tier.name}` }),
    el('input', {
      id: `quantity-${tier.id}`,
      name: 'quantity',
      type: 'number',
      min: soldOut ? '0' : '1',
      max: String(limit),
      value: soldOut ? '0' : '1',
      disabled: soldOut,
    }),
  ]);

  if (!soldOut) {
    const quantityInput = quantityField.querySelector('input');
    const clampQuantity = () => {
      const value = Number(quantityInput.value);
      quantityInput.value = String(Math.min(limit, Math.max(1, Number.isFinite(value) ? value : 1)));
    };
    quantityInput.addEventListener('input', clampQuantity);
    quantityInput.addEventListener('change', clampQuantity);
  }

  const action = el('button', {
    type: 'button',
    className: 'button button-primary',
    disabled: soldOut,
    text: soldOut ? 'Sold out' : 'Choose tickets',
  });

  action.addEventListener('click', async () => {
    const quantityInput = quantityField.querySelector('input');
    let quantity = Number(quantityInput.value);
    quantity = Math.min(10, tier.seatsLeft, Math.max(1, Number.isFinite(quantity) ? quantity : 1));
    quantityInput.value = String(quantity);
    action.disabled = true;
    try {
      activeBooking = await createBooking({ tierId: tier.id, quantity });
      tier.sold += quantity;
      tier.seatsLeft = tier.capacity - tier.sold;
      renderCheckout();
    } catch (error) {
      showMessage(checkoutMessage, error.message || 'Could not create booking.');
    } finally {
      action.disabled = soldOut;
    }
  });

  tierRow.append(details, quantityField, action);
  return tierRow;
}

const checkoutMessage = el('div', { id: 'booking-message' });
const checkoutSection = el('section', { id: 'checkout', className: 'checkout', hidden: true });

function startCountdown(createdAt, holdSeconds) {
  if (countdownTimer) window.clearInterval(countdownTimer);
  const end = new Date(createdAt).getTime() + holdSeconds * 1000;
  const countdown = checkoutSection.querySelector('#hold-countdown');

  function update() {
    const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    countdown.textContent = `${minutes}:${String(seconds).padStart(2, '0')} remaining`;
    if (remaining === 0) {
      window.clearInterval(countdownTimer);
      countdown.textContent = 'Seat hold expired';
    }
  }
  update();
  countdownTimer = window.setInterval(update, 1000);
}

function renderCheckout() {
  if (!activeBooking) return;
  checkoutSection.hidden = false;
  checkoutSection.replaceChildren();

  const countdown = el('p', { id: 'hold-countdown', className: 'countdown' });
  const paymentError = el('div', { id: 'payment-message' });
  const declineField = el('label', { className: 'check-field' }, [
    el('input', { id: 'decline-card', name: 'decline', type: 'checkbox' }),
    el('span', { text: 'Simulate declined card' }),
  ]);

  const cardField = el('div', { className: 'form-field' }, [
    el('label', { for: 'mock-card', text: 'Mock card number' }),
    el('input', { id: 'mock-card', name: 'cardNumber', type: 'text', inputmode: 'numeric', placeholder: 'Any mock card number', autocomplete: 'off' }),
  ]);

  const payButton = el('button', { type: 'submit', className: 'button button-primary', text: 'Pay now' });
  const form = el('form', { id: 'payment-form', className: 'payment-form' }, [
    cardField,
    declineField,
    payButton,
  ]);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    payButton.disabled = true;
    paymentError.replaceChildren();
    try {
      const paid = await pay(activeBooking.reference, {
        decline: form.querySelector('#decline-card').checked,
      });
      activeBooking = paid;
      showMessage(paymentError, `Payment successful. Booking reference: ${paid.reference}`, 'success-message');
      payButton.hidden = true;
    } catch (error) {
      showMessage(paymentError, error.message || 'Payment failed. Try again.');
      payButton.disabled = false;
    }
  });

  checkoutSection.append(
    checkoutMessage,
    el('h2', { text: 'Checkout' }),
    el('p', { text: `Reference: ${activeBooking.reference}` }),
    el('p', { text: `Quantity: ${activeBooking.quantity}` }),
    el('p', { text: `Amount: ${formatPriceCents(activeBooking.amountCents)}` }),
    countdown,
    form,
    paymentError,
  );
  startCountdown(activeBooking.createdAt, activeBooking.holdSeconds);
}

async function initialize() {
  app.replaceChildren(el('p', { text: 'Loading event...' }));
  if (!eventId) {
    app.replaceChildren(el('h1', { text: 'Event not found' }),
      el('a', { className: 'back-link', href: '/index.html', text: 'Back to events' }));
    return;
  }
  try {
    const event = await getEvent(eventId);
    const eventHeader = el('section', { className: 'event-header' }, [
      el('a', { className: 'back-link', href: '/index.html', text: '← Back to events' }),
      el('p', { className: 'event-city', text: event.city }),
      el('h1', { text: event.title }),
      el('p', { text: `${event.venue} · ${formatDate(event.startsAt)}` }),
    ]);
    const tierList = el('section', { className: 'tier-list', 'aria-label': 'Ticket tiers' }, [
      el('h2', { text: 'Choose a ticket tier' }),
    ]);

    for (const tier of event.tiers) tierList.appendChild(renderTier(tier));
    checkoutSection.append(checkoutMessage);
    app.replaceChildren(eventHeader, tierList, checkoutSection);
  } catch (error) {
    app.replaceChildren(
      el('h1', { text: 'Event not found' }),
      el('p', { className: 'error-message', text: error.message || 'Could not load this event.' }),
      el('a', { className: 'back-link', href: '/index.html', text: 'Back to events' }),
    );
  }
}

initialize();
