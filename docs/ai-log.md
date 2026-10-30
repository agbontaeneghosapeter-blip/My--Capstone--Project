# AI log

Every time you give an AI tool a significant prompt, add an entry. Three lines each.
"Nothing was wrong" is allowed, but it is rarely true. Your instructor will read this.

## Build 2

### Prompt 1: Build 2 prompt (docs/build-2.md)
- **What I asked:** Implement Build 2 merge sorting, event publishing and summaries, event search, and acceptance-criteria tests without outside packages.
- **What came back:** Added the requested domain behavior, Node test coverage, and the `npm test` command.
- **What was wrong (or "nothing"):** The starter accepted impossible dates such as February 30 because native `Date` parsing normalizes them. I added strict ISO calendar validation and tests. The S04 section was blank, so I wrote its three acceptance criteria and covered them.

### Prompt 2:
- **What I asked:**
- **What came back:**
- **What was wrong (or "nothing"):**

## Build 3

- **What I asked:** Add the booking state machine, layered architecture diagrams, a small parameterized router, a Node HTTP server with health/API/static-file behavior, port configuration, and tests without dependencies.
- **What came back:** Added the state machine, router and HTTP app, static entry page, configuration/start script, architecture diagrams, and state/router/HTTP tests.
- **What was wrong (or "nothing"):** Static paths need both lexical and resolved-path checks to prevent traversal and symlink escapes. The server applies both checks; no other rule was uncertain.
