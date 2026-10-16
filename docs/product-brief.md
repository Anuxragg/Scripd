# Scripd product brief

## Product vision

Scripd helps people remember what they read and find their next book through the reading lives of people they trust. The product takes inspiration from social logging communities such as Letterboxd, with books, reading history, and reader relationships at its center.

## Primary users

- Readers who want a reliable record of books they have finished, are reading, or want to read.
- Readers who use ratings and reviews to decide what to pick up next.
- Readers who want to follow friends and discover books through their activity.

## Core loop

1. Find a book in the catalog.
2. Add it to a personal reading list or record a reading.
3. Add dates, a rating, or a review when useful.
4. Follow readers and discover books through their activity.
5. Return to the profile to see a lasting record of reading.

## MVP scope

- Account registration, login, refresh, logout, and a private account profile.
- Book search backed by a canonical Scripd catalog populated from Open Library metadata.
- Personal book states: want to read, currently reading, read, and did not finish.
- Reading entries with start and finish dates; a member can reread a book and keep separate entries.
- Ratings and written reviews attached to a reading entry, with editing and deletion by the author.
- Public profiles and a chronological feed from followed readers.
- Responsive, accessible web flows for those capabilities.

## Product rules

- A book is a catalog work; a reading entry is a member's specific attempt to read it. Ratings, dates, and reviews belong to the entry so rereads remain distinct.
- Users own their account data and can edit or remove their reading entries and reviews.
- Public discovery must not reveal private account information. Privacy settings are enforced in the API as well as the UI.
- Catalog metadata keeps source identifiers and attribution so imported records can be refreshed and corrected.
- Social features must not block the core personal reading log.

## Not in the first release

- Redis, distributed caching, and background workers.
- Recommendations based on machine learning.
- Direct messages, groups, paid plans, and third-party sign-in.
- A native mobile application.

## Quality bar

- Keep authentication secrets and password hashes out of API responses and logs.
- Validate inputs at the API boundary and enforce domain rules in services.
- Store durable user, catalog, reading, review, follow, and feed source data in PostgreSQL.
- Keep migrations reversible and make reads/writes transactional where one action changes multiple records.
- Give APIs stable error codes, request IDs, and bounded request/database timeouts.
- Make core flows keyboard accessible and usable on narrow screens.
- Add tests alongside each feature layer as that layer is implemented; do not ship a feature whose critical security or data rules are unverified.

## Initial product measures

- New members who add their first book during their first session.
- Members who record a first reading entry within seven days.
- Weekly active readers who add or update a reading entry.
- Search success rate: searches that lead to a book detail view or reading action.
- Feed availability and API error rate once social features are enabled.
