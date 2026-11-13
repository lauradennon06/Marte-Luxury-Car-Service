import db from "#db/client";

/** Record when the card-on-file link was texted to the customer */
export async function markCardLinkSent(rideId) {
  const result = await db.query(
    "UPDATE rides SET payment_link_sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
    [rideId],
  );
  return result.rows[0];
}

/**
 * Store the saved card and the customer's consent, and mark the quote accepted.
 * Only succeeds while the ride is still awaiting a card (single use).
 */
export async function saveRideCard(rideId, { customerId, cardId, brand, last4 }) {
  const result = await db.query(
    `UPDATE rides
     SET square_customer_id = $1,
         square_card_id = $2,
         card_brand = $3,
         card_last4 = $4,
         card_consent_at = CURRENT_TIMESTAMP,
         status = 'customer_confirmed',
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $5 AND status = 'price_pending' AND square_card_id IS NULL
     RETURNING *`,
    [customerId, cardId, brand, last4, rideId],
  );
  return result.rows[0];
}

export default { markCardLinkSent, saveRideCard };
