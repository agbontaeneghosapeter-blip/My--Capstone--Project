# API examples

Start the server with `npm start`; these examples use `http://localhost:3000`.
The temporary `x-user-id` values identify organizers and attendees until Build 7.
All prices are whole cents. The mock payment API never accepts card numbers;
send `{"decline":true}` to simulate a decline.

## Create an event and ticket tier

```sh
curl -X POST http://localhost:3000/api/events \
  -H "content-type: application/json" \
  -H "x-user-id: organizer-1" \
  -d '{"title":"Lagos Jazz Night","city":"Lagos","venue":"Civic Hall","startsAt":"2027-05-10T18:00:00Z"}'
```

Use the returned event `id` as `EVENT_ID`:

```sh
curl -X POST http://localhost:3000/api/events/EVENT_ID/tiers \
  -H "content-type: application/json" \
  -H "x-user-id: organizer-1" \
  -d '{"name":"General","priceCents":1250,"capacity":100}'
```

## Publish and search

```sh
curl -X POST http://localhost:3000/api/events/EVENT_ID/publish \
  -H "x-user-id: organizer-1"
```

```sh
curl "http://localhost:3000/api/events?q=jazz&city=lagos&maxPriceCents=2000&sortBy=price"
```

## Book and pay

Use the tier `id` from the create-tier response as `TIER_ID`:

```sh
curl -X POST http://localhost:3000/api/bookings \
  -H "content-type: application/json" \
  -H "x-user-id: attendee-1" \
  -d '{"tierId":"TIER_ID","quantity":2}'
```

To try a declined payment, use the booking `reference` as `BOOKING_REFERENCE`:

```sh
curl -X POST http://localhost:3000/api/bookings/BOOKING_REFERENCE/pay \
  -H "content-type: application/json" \
  -H "x-user-id: attendee-1" \
  -d '{"decline":true}'
```

A declined attempt leaves the booking pending, so retry without the decline flag:

```sh
curl -X POST http://localhost:3000/api/bookings/BOOKING_REFERENCE/pay \
  -H "x-user-id: attendee-1"
```

## Cancel an unpaid booking

Create another booking as above and use its reference here. Only pending bookings
can be cancelled in this build.

```sh
curl -X POST http://localhost:3000/api/bookings/BOOKING_REFERENCE/cancel \
  -H "x-user-id: attendee-1"
```
