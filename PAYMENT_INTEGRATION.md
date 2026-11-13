# Card on File (Square) - Payment Integration

Source of truth for how a customer saves a card after receiving a price quote.

## Flow

1. Customer submits a ride request (status `pending`).
2. Admin sends a quote: `PATCH /rides/:id/send-price` with `{ total_cost }`.
   - Saves `total_cost`, sets status `price_pending`.
   - Creates a signed, expiring (7 days) token bound to the ride and the exact quote amount ([utils/cardLink.js](utils/cardLink.js)).
   - Texts the customer the quote and a link: `${FRONTEND_URL}/save-card/<token>`.
   - Re-sending a quote changes the amount, which invalidates any older link.
3. Customer opens the link. The frontend page `/save-card/:token` ([SaveCard.jsx](../../front-end/frontend/src/pages/SaveCard.jsx)):
   - `GET /payments/card-session/:token` returns the quote summary and Square's public config (application ID, location ID, environment).
   - Renders Square's Web Payments card form, shows a required consent checkbox, and tokenizes the card in the browser.
4. `POST /payments/save-card` with `{ token, sourceId, verificationToken, consent: true }`:
   - Finds/creates the Square customer (phone in E.164), then calls the Cards API (`cardsApi.createCard`) to store the card on that customer.
   - Stores `square_customer_id`, `square_card_id`, `card_brand`, `card_last4`, `card_consent_at`; sets status `customer_confirmed`.
   - Texts the admin. The card is **not charged**.
5. Admin clicks **Confirm Booking** (status `approved`), which texts the customer the confirmation.

Customers decline by replying `CANCEL`. Replying `CONFIRM` does not accept a quote; the reply tells them to use the secure link. Card details are never sent by text and never reach our servers (Square's form tokenizes them).

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| PATCH | `/rides/:id/send-price` | admin JWT | Send quote + card link |
| GET | `/payments/card-session/:token` | link token | Quote summary + Square form config |
| POST | `/payments/save-card` | link token | Save card on file |

## Configuration (`back-end/backend/.env`)

```
SQUARE_ENV=sandbox            # or production
SQUARE_ACCESS_TOKEN=...
SQUARE_APPLICATION_ID=...     # sandbox IDs look like sandbox-sq0idb-...
SQUARE_LOCATION_ID=...
FRONTEND_URL=http://localhost:5173
JWT_SECRET=...                # also used (with a suffix) to sign card links
```

Production: use production credentials and serve the site over HTTPS (Square's card form requires it).

## Database

Columns on `rides`: `square_customer_id`, `square_card_id`, `card_brand`, `card_last4`, `card_consent_at`, `payment_link_sent_at`.
Existing databases: `psql -d martedb -f db/migrations/001_card_on_file.sql`.

## Testing (sandbox)

Use test card `4111 1111 1111 1111`, any future expiry, any CVV/ZIP. Server-side, `cnon:card-nonce-ok` is a sandbox-only source ID.

## Not implemented

Charging the saved card, and any no-show/cancellation fee policy. The consent text only covers saving the card and charging the agreed fare under the Terms of Service.
