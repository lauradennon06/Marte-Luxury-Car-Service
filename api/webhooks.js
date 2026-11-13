import { Router } from "express";
import { getRidesByPhoneNumber, updateRideStatus } from "#db/queries/rides";
import {
  sendCustomerCancelledNotificationToAdmin,
} from "#utils/sms";
import fs from "fs";
import path from "path";

const router = Router();

// File-based logging for debugging webhooks
const logFile = path.join(process.cwd(), "webhook-debug.log");
function log(message) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  process.stderr.write(logLine); // Write to stderr (appears in terminal)
  fs.appendFileSync(logFile, logLine); // Also write to file
}

// Health check endpoint to verify webhook router is working
router.get("/health", (req, res) => {
  console.log("✅ Webhook health check called");
  res.json({ status: "ok", message: "Webhook router is working" });
});

// Format phone number to remove +1 and special characters for database lookup
function normalizePhoneNumber(phoneNumber) {
  // Remove all non-digit characters
  let cleaned = phoneNumber.replace(/\D/g, "");

  // If it starts with 1 (country code), remove it to get 10-digit number
  if (cleaned.startsWith("1") && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }

  return cleaned;
}

// Generate all possible formats of a phone number for matching
function generatePhoneFormats(phoneNumber) {
  const normalized = normalizePhoneNumber(phoneNumber);
  const formats = new Set();

  // Add 10-digit format (no country code)
  formats.add(normalized);

  // Add E.164 format (+1XXXXXXXXXX)
  if (!normalized.startsWith("1")) {
    formats.add(`1${normalized}`);
  }
  formats.add(`+1${normalized}`);

  // Add formatted versions
  if (normalized.length === 10) {
    formats.add(
      `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`,
    );
    formats.add(`(${normalized.slice(0, 3)}) ${normalized.slice(3)}`);
    formats.add(
      `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`,
    );
    formats.add(
      `${normalized.slice(0, 3)}.${normalized.slice(3, 6)}.${normalized.slice(6)}`,
    );
  }

  return Array.from(formats);
}

// POST /webhooks/twilio/sms - Receive incoming SMS from Twilio
router.post("/twilio/sms", async (req, res) => {
  try {
    const { MessageSid, From, To, Body, NumMedia } = req.body;

    log("📨 Incoming SMS from Twilio:");
    log(`  From: ${From}`);
    log(`  To: ${To}`);
    log(`  Message: ${Body}`);
    log(`  Message SID: ${MessageSid}`);
    log(`  Media: ${NumMedia || 0} attachments`);

    // Parse customer response
    const response = Body.trim().toLowerCase();

    let replyText =
      "Thank you for your message! Our team will respond shortly.";

    // Accepting a quote requires saving a card through the secure link, not a text reply
    if (response === "confirm") {
      replyText =
        "To accept your quote, please open the secure link in your quote text to save your card on file. Never text your card details.";
    } else if (response === "cancel") {
      // Generate multiple phone formats to try
      const phoneFormats = generatePhoneFormats(From);
      console.log(`Trying phone formats: ${phoneFormats.join(", ")}`);

      let rides = [];
      let matchedFormat = null;

      // Try each format until we find rides
      for (const format of phoneFormats) {
        const result = await getRidesByPhoneNumber(format);
        if (result && result.length > 0) {
          rides = result;
          matchedFormat = format;
          break;
        }
      }

      console.log(
        `Matched format: ${matchedFormat}, Found ${rides.length} rides`,
      );

      const pendingRide =
        rides && rides.find((r) => r.status === "price_pending");

      if (pendingRide) {
        // Update ride status to cancelled
        await updateRideStatus(pendingRide.id, "cancelled");

        // Notify admin that customer cancelled
        const adminPhoneNumber = process.env.ADMIN_PHONE_NUMBER;
        if (adminPhoneNumber) {
          try {
            await sendCustomerCancelledNotificationToAdmin(
              adminPhoneNumber,
              pendingRide,
            );
          } catch (smsErr) {
            console.error("Failed to send admin notification:", smsErr);
          }
        }

        console.log(`✅ Customer cancelled ride ${pendingRide.id}`);
      } else {
        console.log(`❌ No pending rides found for customer ${From}`);
      }
    }

    // Respond to Twilio with success
    // Use TwiML format to send a reply
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${replyText}</Message>
</Response>`;

    res.type("application/xml");
    res.send(twiml);
  } catch (error) {
    log("❌ Error handling Twilio webhook:" + error.message);
    log(error.stack);
    res.status(500).send("Error processing message");
  }
});

// POST /webhooks/twilio/call - Receive incoming calls from Twilio (optional)
router.post("/twilio/call", (req, res) => {
  try {
    const { CallSid, From, To, CallStatus } = req.body;

    console.log("📞 Incoming call from Twilio:");
    console.log(`  From: ${From}`);
    console.log(`  To: ${To}`);
    console.log(`  Status: ${CallStatus}`);
    console.log(`  Call SID: ${CallSid}`);

    // Respond with TwiML
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Thank you for calling Marte Luxury Car Service. Please hold while we connect you.</Say>
</Response>`;

    res.type("application/xml");
    res.send(twiml);
  } catch (error) {
    console.error("❌ Error handling call webhook:", error.message);
    res.status(500).send("Error processing call");
  }
});

export default router;
