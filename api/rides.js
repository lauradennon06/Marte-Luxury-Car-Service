import { Router } from "express";
import requireUser from "#middleware/requireUser";
import requireBody from "#middleware/requireBody";
import {
  createRide,
  getRidesByUserId,
  getRideById,
  getRidesByPhoneNumber,
  getAllRides,
  updateRideStatus,
  updateRideTotalCost,
  updatePaidStatus,
  updateRide,
  updateRideAdmin,
  deleteRide,
  getRideStatistics,
} from "#db/queries/rides";
import {
  sendRideApprovalSMS,
  sendPaymentReminderSMS,
  sendRideCompletionSMS,
  sendRideRequestNotificationToAdmin,
  sendRideConfirmationToCustomer,
  sendPriceQuoteWithCardLink,
  sendRideCancellationToCustomer,
} from "#utils/sms";
import { createCardLinkToken, buildCardLinkUrl } from "#utils/cardLink";
import { markCardLinkSent } from "#db/queries/payments";

const router = Router();

// POST /rides - Create a new ride request (authenticated or anonymous)
router.post(
  "/",
  requireBody(
    "first_name",
    "last_name",
    "phone_number",
    "pickup_location",
    "dropoff_location",
    "pickup_date",
    "pickup_time",
    "num_passengers",
  ),
  async (req, res, next) => {
    try {
      const {
        first_name,
        last_name,
        phone_number,
        email,
        pickup_location,
        dropoff_location,
        pickup_date,
        pickup_time,
        num_passengers,
        special_requests,
      } = req.body;

      // Get user_id if authenticated, otherwise null
      const userId = req.user ? req.user.id : null;

      const ride = await createRide(userId, {
        first_name,
        last_name,
        phone_number,
        email,
        pickup_location,
        dropoff_location,
        pickup_date,
        pickup_time,
        num_passengers,
        special_requests,
      });

      // Send SMS notifications
      try {
        // Send admin notification
        const adminPhoneNumber = process.env.ADMIN_PHONE_NUMBER;
        if (adminPhoneNumber) {
          await sendRideRequestNotificationToAdmin(adminPhoneNumber, ride);
        }

        // Send customer confirmation
        await sendRideConfirmationToCustomer(phone_number, ride);
      } catch (smsError) {
        // Log SMS errors but don't fail the request
        console.error("SMS notification error:", smsError.message);
      }

      res.status(201).json({ success: true, data: ride });
    } catch (err) {
      next(err);
    }
  },
);

// GET /rides - Get rides (users see their own, admins see all)
router.get("/", requireUser, async (req, res, next) => {
  try {
    let rides;

    if (req.user.role === "admin") {
      // Admin can filter by status, paid_status, and date range
      const filters = {};
      if (req.query.status) filters.status = req.query.status;
      if (req.query.paid_status) filters.paid_status = req.query.paid_status;
      if (req.query.startDate) filters.startDate = req.query.startDate;
      if (req.query.endDate) filters.endDate = req.query.endDate;

      rides = await getAllRides(filters);
    } else {
      // Regular users see only their own rides
      rides = await getRidesByUserId(req.user.id);
    }

    res.json({ success: true, data: rides });
  } catch (err) {
    next(err);
  }
});

// GET /rides/phone/:phone - Get rides by phone number
router.get("/phone/:phone", async (req, res, next) => {
  try {
    const rides = await getRidesByPhoneNumber(req.params.phone);
    res.json({ success: true, data: rides });
  } catch (err) {
    next(err);
  }
});

// GET /rides/stats - Admin dashboard statistics
router.get("/stats", requireUser, async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    const stats = await getRideStatistics();
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

// GET /rides/:id - Get single ride details
router.get("/:id", requireUser, async (req, res, next) => {
  try {
    const ride = await getRideById(req.params.id);

    if (!ride) {
      return res.status(404).json({ success: false, error: "Ride not found" });
    }

    // Users can only see their own rides, admins can see all
    if (req.user.role !== "admin" && ride.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    res.json({ success: true, data: ride });
  } catch (err) {
    next(err);
  }
});

// PATCH /rides/:id/status - Update ride status (admin only, triggers SMS)
router.patch(
  "/:id/status",
  requireUser,
  requireBody("status"),
  async (req, res, next) => {
    try {
      // Check if user is admin
      if (req.user.role !== "admin") {
        return res.status(403).json({ success: false, error: "Unauthorized" });
      }

      const { status } = req.body;
      const rideId = req.params.id;

      // Get ride details before updating (for SMS)
      const rideDetails = await getRideById(rideId);

      if (!rideDetails) {
        return res
          .status(404)
          .json({ success: false, error: "Ride not found" });
      }

      // Update the ride status
      const updatedRide = await updateRideStatus(rideId, status);

      // Send SMS based on status change
      if (status === "approved") {
        try {
          await sendRideApprovalSMS(rideDetails.phone_number, rideDetails);
        } catch (smsErr) {
          console.error("SMS failed but ride was updated:", smsErr);
          // Don't fail the request if SMS fails, but log it
        }
      } else if (status === "completed") {
        try {
          await sendRideCompletionSMS(rideDetails.phone_number, rideDetails);
        } catch (smsErr) {
          console.error("SMS failed but ride was updated:", smsErr);
        }
      } else if (status === "cancelled") {
        try {
          await sendRideCancellationToCustomer(rideDetails.phone_number);
        } catch (smsErr) {
          console.error("SMS failed but ride was updated:", smsErr);
        }
      }

      res.json({ success: true, data: updatedRide });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /rides/:id/paid-status - Update paid status (admin only, sends reminder if unpaid)
router.patch(
  "/:id/paid-status",
  requireUser,
  requireBody("paid_status"),
  async (req, res, next) => {
    try {
      // Check if user is admin
      if (req.user.role !== "admin") {
        return res.status(403).json({ success: false, error: "Unauthorized" });
      }

      const { paid_status } = req.body;
      const rideId = req.params.id;

      // Get ride details before updating
      const rideDetails = await getRideById(rideId);

      if (!rideDetails) {
        return res
          .status(404)
          .json({ success: false, error: "Ride not found" });
      }

      // Update the paid status
      const updatedRide = await updatePaidStatus(rideId, paid_status);

      // Send payment reminder if marked as unpaid
      if (paid_status === "unpaid") {
        try {
          await sendPaymentReminderSMS(rideDetails.phone_number, rideDetails);
        } catch (smsErr) {
          console.error("SMS failed but ride was updated:", smsErr);
        }
      }

      res.json({ success: true, data: updatedRide });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /rides/:id - Update ride (users can edit pending rides only, admins can edit any ride)
router.patch("/:id", requireUser, async (req, res, next) => {
  try {
    let updatedRide;

    // Admin users can update any ride with ride request fields
    if (req.user.role === "admin") {
      const {
        first_name,
        last_name,
        phone_number,
        email,
        pickup_location,
        dropoff_location,
        pickup_date,
        pickup_time,
        num_passengers,
        special_requests,
      } = req.body;

      updatedRide = await updateRideAdmin(req.params.id, {
        first_name,
        last_name,
        phone_number,
        email,
        pickup_location,
        dropoff_location,
        pickup_date,
        pickup_time,
        num_passengers,
        special_requests,
      });
    } else {
      // Regular users can only update specific fields on pending rides
      const {
        service_description,
        car_make,
        car_model,
        car_year,
        scheduled_date,
        total_cost,
      } = req.body;

      updatedRide = await updateRide(req.params.id, req.user.id, {
        service_description,
        car_make,
        car_model,
        car_year,
        scheduled_date,
        total_cost,
      });
    }

    res.json({ success: true, data: updatedRide });
  } catch (err) {
    next(err);
  }
});

// PATCH /rides/:id/send-price - Text price quote + secure "Save your card" link to customer (admin only)
router.patch(
  "/:id/send-price",
  requireUser,
  requireBody("total_cost"),
  async (req, res, next) => {
    try {
      // Check if user is admin
      if (req.user.role !== "admin") {
        return res.status(403).json({ success: false, error: "Unauthorized" });
      }

      const { total_cost } = req.body;
      const rideId = req.params.id;

      // Get ride details before updating
      const rideDetails = await getRideById(rideId);

      if (!rideDetails) {
        return res
          .status(404)
          .json({ success: false, error: "Ride not found" });
      }

      // Only a pending quote can be (re)sent, and never once a card is saved
      if (
        !["pending", "price_pending"].includes(rideDetails.status) ||
        rideDetails.square_card_id
      ) {
        return res.status(400).json({
          success: false,
          error: "A price quote can't be sent for a ride in its current state",
        });
      }

      // Save the total_cost first so the card link is bound to this exact quote
      await updateRideTotalCost(rideId, total_cost);
      const rideWithStatus = await updateRideStatus(rideId, "price_pending");

      // Secure "Save your card" link (page in our app, uses Square's card form)
      const cardLink = buildCardLinkUrl(
        createCardLinkToken(rideWithStatus, rideWithStatus.total_cost),
      );

      try {
        await sendPriceQuoteWithCardLink(rideDetails.phone_number, rideWithStatus, cardLink);
        await markCardLinkSent(rideId);
        console.log(`✅ Price quote with card link sent for ride ${rideId}: $${total_cost}`);
      } catch (smsErr) {
        console.error("SMS failed but price status was set:", smsErr);
        // Don't fail the request if SMS fails
      }

      res.json({ success: true, data: rideWithStatus });
    } catch (err) {
      console.error("Error in send-price endpoint:", err);
      next(err);
    }
  },
);

// DELETE /rides/:id - Delete ride (users can delete pending rides only)
router.delete("/:id", requireUser, async (req, res, next) => {
  try {
    const deleted = await deleteRide(req.params.id, req.user.id, req.user.role);
    res.json({ success: true, message: "Ride deleted", data: deleted });
  } catch (err) {
    next(err);
  }
});

export default router;
