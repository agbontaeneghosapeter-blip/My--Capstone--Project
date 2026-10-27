# AI log

## Build 1: Domain core in the terminal

### Entry 1: First draft from the Build 1 prompt

**What I asked**
I gave the AI tool README.md and docs/build-1.md, then pasted the Build 1 prompt. It asked for `errors.js`, `ids.js`, `waitlistQueue.js`, `inventory.js`, `scripts/demo.js` and `scripts/benchmark-lookup.js`, plus `demo` and `benchmark` scripts in `package.json`.

**What came back**
Seven files. `npm run demo` told the whole story (sell-out, refused booking, waitlist, cancellation, next in line named). `npm run benchmark` showed `Map.get` about 1,000 times faster than `Array.find` over 100,000 bookings. The AI also listed the rules it was unsure about.

**What was wrong**
I compared the draft with my tutor's reference code. It passed the "Done when" list, but it was wrong or weaker in these ways:

1. **Waitlist rule too strict.** My draft only let someone join the waitlist when the tier had zero seats left (`SEATS_AVAILABLE`). The tutor's rule is better: you are blocked only if enough seats are free for the quantity you want (`NOT_SOLD_OUT`). Someone who wants 2 seats can still wait when only 1 seat is left.
2. **Missing waitlist `quantity`.** My waitlist entries only stored a name. The tutor's entries are `{ userId, quantity }`. Without a quantity, the system cannot tell whether the seats released by a cancellation are enough for the person at the front of the line.
3. **Argument style.** My draft used an options object: `bookTickets(store, tierId, { userId, quantity })`. The tutor's uses plain arguments: `bookTickets(store, tierId, userId, quantity)`. Same for `joinWaitlist`. Code written for the tutor's version would not have worked with mine.
4. **Event fields.** Mine had `name` and `startsAt` only. The tutor's has `title`, `city`, `venue`, `startsAt`, `organizerId` and `status: 'draft'`, and stores `startsAt` as an ISO string.
5. **`cancelBooking` return value and missing function.** Mine returned `{ booking, nextInLine }`. The tutor's returns the booking, and a separate `offerNextOnWaitlist` function takes the next person off the queue if enough seats are free. Mine had no such function.
6. **Error handling.** My draft had an `ErrorCodes` list and no `details` on `DomainError`. The tutor's error class has an optional `details` object, which the sold-out error uses (`{ seatsLeft }`). My cancel-twice code was `ALREADY_CANCELLED`; the tutor's is `INVALID_STATE`, driven by a `HOLDS_SEATS` set of statuses that hold seats.
7. **Booking status and sold-out message.** I used `status: 'CONFIRMED'` and later `'cancelled'`. The tutor's starts at `'pending'` (a later build adds `'paid'`). The tutor's sold-out message also says "X is sold out" when nothing is left, instead of always "Only N ticket(s) left".
8. **Reference codes.** Mine used a 29-character alphabet and `randomInt`, with a function called `newReference()`. The tutor's uses a 32-character alphabet and `byte % 32`, which is unbiased because 32 divides 256 evenly, with a function called `referenceCode()`. Both were safe; the names were different.
9. **Queue.** Mine behaved the same but had no `toArray()` method. The tutor's has one, which will be useful for showing the whole waitlist.

**What I changed**
I replaced `errors.js`, `ids.js`, `inventory.js`, `demo.js` and `benchmark-lookup.js` so they match the tutor's signatures and rules. I dropped two extra checks my draft had (validating `userId`, and checking the total price is a safe integer) so the behaviour matches exactly. I re-ran `npm run demo` and `npm run benchmark` and both worked.

**What I learned**
- A draft can pass every item in "Done when" and still miss a rule that matters later. The waitlist `quantity` only shows up as a problem when seats are released.
- The prompt fixed the rules but not the names or argument shapes, so two valid solutions can be incompatible with each other. Later builds import these functions, so signatures have to be agreed in the prompt.
- Dropping my `userId` check means `bookTickets(store, tierId, '', 1)` now succeeds. The tutor's code does not validate it either, so this is a gap I want to raise.

### Entry 2: Bug from a mismatched pair of files

**What I asked**
I asked the AI to make `errors.js` match the tutor's version (no `ErrorCodes`, with `details`).

**What came back**
A new `errors.js` and an updated `inventory.js`.

**What was wrong**
I only replaced `errors.js`. My old `inventory.js` still imported `ErrorCodes`, and `npm run benchmark` crashed with "does not provide an export named 'ErrorCodes'".

**What I changed**
I replaced `inventory.js` with the updated version, so the files were consistent again.

**What I learned**
Files that import each other have to be updated together. A mismatch only shows up when the code runs, so I run `npm run demo` and `npm run benchmark` after every change.

### Open question for class

If the person at the head of the waitlist wants 4 seats and only 1 is free, `offerNextOnWaitlist` returns nothing and everyone behind them keeps waiting, even if they only need 1 seat. Is strict first-in-first-out the right rule?

## Build 2: Search, sorting and the first tests

### Entry 1: Build 2 domain and test implementation

**What I asked**
I asked for a stable merge sort; publishing and public event summaries; pure search, filter and sort functions; acceptance tests for S02, S03, S04, S05 and S06; and an `npm test` script.

**What came back**
A recursive merge sort, event publishing and summary projections in `inventory.js`, pure search functions, Build 2 acceptance criteria for S04, and 20 `node:test` tests.

**What was wrong**
I needed to review the date and output contracts carefully. The implementation validates ISO-style criteria, uses the published event summary shape, and keeps sorting/filtering independent of the input array.

**What I changed**
I added the tests and ran `npm test`; all 20 tests passed.

**What I learned**
A stable merge sort and pure projections are easier to verify when tests separately cover every tie-break and error path.
