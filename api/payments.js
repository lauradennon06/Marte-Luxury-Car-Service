import { Router } from "express";
import requireBody from "#middleware/requireBody";
import { getRideById } from "#db/queries/rides";
import { saveRideCard } from "#db/queries/payments";
import { verifyCardLinkToken } from "#utils/cardLink";
import {
  getOrCreateSquareCustomer,
  saveCardOnFile,
  getWebPaymentsConfig,
} from "#utils/square";
import { sendCardOnFileConfirmationToAdmin } from "#utils/sms";

const router = Router();

// Resolves the ride a card link belongs to, or sends the error response and returns null
async function resolveCardLink(token, res) {
  let link;
  try {
    link = verifyCardLinkToken(token);
  } catch {
    res.status(400).json({
      success: false,
      error: "This link is invalid or has expired. Please contact us for a new one.",
    });
    return null;
  }

  const ride = await getRideById(link.rideId);
  if (!ride || Number(ride.total_cost).toFixed(2) !== link.amount) {
    res.status(400).json({
      success: false,
      error: "This quote is no longer valid. Please contact us for a new one.",
    });
    return null;
  }

  return ride;
}

/**
 * GET /payments/card-session/:token
 * Public (token-protected). Returns the quote summary and Square's public form config.
 */
router.get("/card-session/:token", async (req, res, next) => {
  try {
    const ride = await resolveCardLink(req.params.token, res);
    if (!ride) return;

    if (ride.status === "cancelled") {
      return res
        .status(400)
        .json({ success: false, error: "This ride request has been cancelled." });
    }

    res.json({
      success: true,
      data: {
        alreadySaved: Boolean(ride.square_card_id),
        ride: {
          first_name: ride.first_name,
          last_name: ride.last_name,
          pickup_location: ride.pickup_location,
          dropoff_location: ride.dropoff_location,
          pickup_date: ride.pickup_date,
          pickup_time: ride.pickup_time,
          total_cost: ride.total_cost,
        },
        square: getWebPaymentsConfig(),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /payments/save-card
 * Public (token-protected). Saves the customer's card on file with Square.
 * Body: { token, sourceId, verificationToken?, consent: true }
 */
router.post(
  "/save-card",
  requireBody("token", "sourceId"),
  async (req, res, next) => {
    try {
      const { token, sourceId, verificationToken, consent } = req.body;

      if (consent !== true) {
        return res.status(400).json({
          success: false,
          error: "You must agree to save your card on file to continue.",
        });
      }

      const ride = await resolveCardLink(token, res);
      if (!ride) return;

      if (ride.square_card_id) {
        return res
          .status(409)
          .json({ success: false, error: "A card is already saved for this ride." });
      }
      if (ride.status !== "price_pending") {
        return res.status(400).json({
          success: false,
          error: "This quote is no longer awaiting a card.",
        });
      }

      let customerId;
      let card;
      try {
        customerId = await getOrCreateSquareCustomer({
          phone: ride.phone_number,
          email: ride.email,
          firstName: ride.first_name,
          lastName: ride.last_name,
        });
        card = await saveCardOnFile({
          customerId,
          sourceId,
          verificationToken,
          rideId: ride.id,
          cardholderName: `${ride.first_name} ${ride.last_name}`,
        });
      } catch (squareErr) {
        console.error("Square save card failed:", squareErr.errors ?? squareErr.message);
        const detail = squareErr.errors?.[0]?.detail;
        return res.status(400).json({
          success: false,
          error: detail || "We couldn't save that card. Please check the details or try another card.",
        });
      }

      const updated = await saveRideCard(ride.id, {
        customerId,
        cardId: card.id,
        brand: card.brand,
        last4: card.last4,
      });
      if (!updated) {
        return res
          .status(409)
          .json({ success: false, error: "This quote is no longer awaiting a card." });
      }

      const adminPhoneNumber = process.env.ADMIN_PHONE_NUMBER;
      if (adminPhoneNumber) {
        try {
          await sendCardOnFileConfirmationToAdmin(adminPhoneNumber, ride);
        } catch (smsErr) {
          console.error("Admin card-on-file SMS failed:", smsErr.message);
        }
      }

      res.json({ success: true, data: { brand: card.brand, last4: card.last4 } });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
