# Architecture

## Layers

```mermaid
flowchart TD
  Client[Browser or API client] --> Routes[HTTP routes]
  Routes --> Services[Application services]
  Services --> Rules[Domain rules]
  Services --> Repositories[Repositories]
  Repositories --> Database[(Database)]
```

- **Routes** may parse HTTP input, call a service, and format its response; they may not contain business rules or access storage directly.
- **Services** may coordinate domain rules and repositories; they may not depend on HTTP request or response objects.
- **Domain rules** may validate and transform domain data; they may not perform I/O or call services, routes, or repositories.
- **Repositories** may read and write persistence; they may not decide business policy or call services and routes.
- **Database** stores data; it does not call application layers.

## Data model

```mermaid
erDiagram
  USERS ||--o{ EVENTS : organizes
  USERS ||--o{ BOOKINGS : makes
  EVENTS ||--|{ TICKET_TIERS : offers
  TICKET_TIERS ||--o{ BOOKINGS : reserves

  USERS {
    string id PK
    string role
  }
  EVENTS {
    string id PK
    string organizer_id FK
    string title
    string city
    string starts_at
    string status
  }
  TICKET_TIERS {
    string id PK
    string event_id FK
    string name
    integer price_cents
    integer capacity
  }
  BOOKINGS {
    string id PK
    string user_id FK
    string tier_id FK
    integer quantity
    integer amount_cents
    string status
  }
```

## Booking life cycle

```mermaid
stateDiagram-v2
  [*] --> pending
  pending --> paid
  pending --> cancelled
  paid --> checked_in
  paid --> refunded
  paid --> cancelled
  cancelled --> [*]
  refunded --> [*]
  checked_in --> [*]
```

`cancelled`, `refunded`, and `checked_in` are final states. No transition leaves them.