# AI log

Every time you give an AI tool a significant prompt, add an entry. Three lines each.
"Nothing was wrong" is allowed, but it is rarely true. Your instructor will read this.

## Build 2

### Prompt 1: Build 2 prompt (docs/build-2.md)
- **What I asked:** Implement Build 2 merge sorting, event publishing and summaries, event search, and acceptance-criteria tests without outside packages.
- **What came back:** Added the requested domain behavior, Node test coverage, and the `npm test` command.
- **What was wrong (or "nothing"):** The starter accepted impossible dates such as February 30 because native `Date` parsing normalizes them. I added strict ISO calendar validation and tests. The S04 section was blank, so I wrote its three acceptance criteria and covered them.

### Prompt 2:
- **What I asked:** No separate second prompt was recorded for this build.
- **What came back:** Not applicable.
- **What was wrong (or "nothing"):** The blank entry should not claim additional work; the Build 2 implementation was completed by Prompt 1.

## Build 3

- **What I asked:** Add the booking state machine, layered architecture diagrams, a small parameterized router, a Node HTTP server with health/API/static-file behavior, port configuration, and tests without dependencies.
- **What came back:** Added the state machine, router and HTTP app, static entry page, configuration/start script, architecture diagrams, and state/router/HTTP tests.
- **What was wrong (or "nothing"):** Static paths need both lexical and resolved-path checks to prevent traversal and symlink escapes. The server applies both checks; no other rule was uncertain.

## Build 4

- **What I asked:** Build a working in-memory REST API for events, tiers, publishing, searching, bookings, mock payment and cancellation.
- **What came back:** Added the repository and service layers, HTTP routes, API examples, and API-level tests.
- **What was wrong (or "nothing"):** The implementation needed to keep business rules in services and HTTP concerns in routes. The final code follows that boundary and no other rule was uncertain.

## Build 5

- **What I asked:** Move the application to SQLite, reproduce the last-seat overselling problem, then fix concurrent reservations atomically.
- **What came back:** Added the SQLite schema and repository, seed and oversell demo scripts, and a 50-request concurrency test.
- **What was wrong (or "nothing"):** I corrected the demo to label the reproduced before-fix numbers separately from the observed after-fix numbers. A lock variable would not work because it is local to one JavaScript process and different processes or server instances do not share it. Checking availability and reserving in separate statements would not work because availability may change after the check; the atomic conditional update alone decides whether the reservation won.

## Build 6

- **What I asked:** Build the plain HTML, CSS and browser ES module frontend for browsing, filtering, booking and mock payment.
- **What came back:** Added both pages, an in-memory mock API/data layer, reusable DOM helpers, responsive styles, tier/quantity controls, checkout countdown and declined-payment retry behavior.
- **What was wrong (or "nothing"):** Browser review confirmed search, city and maximum-price filtering, sold-out tier disabling, the 10-minute countdown, declined-payment retry and successful payment. It found that the quantity input could temporarily display a value above 10; I added immediate input/change clamping so the control itself stays within 10 and the remaining seats. The mock hold duration was not specified, so it uses a clearly displayed 10-minute countdown.
