const accountSid = process.env.TWILIO_ACCOUNT_SID;
const apiKeySid = process.env.TWILIO_API_KEY_SID;
const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// Format phone number to E.164 format required by Twilio
function formatPhoneNumber(phoneNumber) {
  if (!phoneNumber) return "";

  // Remove all non-digit characters except + at the beginning
  let cleaned = phoneNumber.replace(/\D/g, "");

  // If the number doesn't start with +1, add it (assuming US numbers)
  if (!cleaned.startsWith("1")) {
    cleaned = "1" + cleaned;
  }

  // If it's already 11 digits and starts with 1, use as-is
  // If it's 10 digits, prepend 1
  if (cleaned.length === 10) {
    cleaned = "1" + cleaned;
  }

  // Return in E.164 format
  return `+${cleaned}`;
}

// Format time from "HH:MM:SS" or "HH:MM" to "h:mm AM/PM"
function formatTimeToAmPm(timeString) {
  if (!timeString) return "";

  // Extract hours and minutes (handle both "HH:MM:SS" and "HH:MM" formats)
  const [hours, minutes] = timeString.split(":").slice(0, 2);
  const hour = parseInt(hours, 10);
  const min = minutes;

  const isPM = hour >= 12;
  const displayHour = hour % 12 || 12;
  const ampm = isPM ? "PM" : "AM";

  return `${displayHour}:${min} ${ampm}`;
}

// Create Basic Auth header for Twilio API
function getAuthHeader() {
  const credentials = `${apiKeySid}:${apiKeySecret}`;
  const encoded = Buffer.from(credentials).toString("base64");
  return `Basic ${encoded}`;
}

// Send SMS via Twilio REST API
async function sendSMS(toNumber, message) {
  // Format the phone number to E.164 format
  const formattedNumber = formatPhoneNumber(toNumber);

  if (!accountSid || !apiKeySid || !apiKeySecret || !twilioPhoneNumber) {
    console.log(
      `[SMS LOG] To: ${formattedNumber}\nMessage: ${message}\n(SMS credentials not configured)`,
    );
    return true;
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages`;

    const formData = new URLSearchParams();
    formData.append("From", twilioPhoneNumber);
    formData.append("To", formattedNumber);
    formData.append("Body", message);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const contentType = response.headers.get("content-type");
    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`Twilio API error (${response.status}): ${responseText}`);
    }

    let data;
    if (contentType && contentType.includes("application/json")) {
      data = JSON.parse(responseText);
    } else if (contentType && contentType.includes("application/xml")) {
      // Extract SID from XML response
      const sidMatch = responseText.match(/<Sid>(.*?)<\/Sid>/);
      data = { sid: sidMatch ? sidMatch[1] : "unknown" };
    } else {
      // Try to parse as JSON, fall back to extracting SID from XML
      try {
        data = JSON.parse(responseText);
      } catch {
        const sidMatch = responseText.match(/<Sid>(.*?)<\/Sid>/);
        data = { sid: sidMatch ? sidMatch[1] : "unknown" };
      }
    }

    console.log(`✅ SMS sent to ${formattedNumber} (SID: ${data.sid})`);
    return true;
  } catch (error) {
    console.error("❌ Error sending SMS:", error.message);
    throw error;
  }
}

export async function sendRideApprovalSMS(customerPhone, rideDetails) {
  try {
    const pickupDate = new Date(rideDetails.pickup_date).toLocaleDateString(
      "en-US",
      { weekday: "short", month: "short", day: "numeric", year: "numeric" },
    );
    const pickupTime = formatTimeToAmPm(rideDetails.pickup_time);
    const message = `✓ CONFIRMED! Your Marte Luxury Car Service ride is confirmed for ${pickupDate} at ${pickupTime}. Driver details will be sent the day prior. You're all set! For any changes, please call +1 (914) 906-5308 or email us.`;
    return await sendSMS(customerPhone, message);
  } catch (error) {
    console.error("❌ Error sending approval SMS:", error.message);
    throw error;
  }
}

export async function sendPaymentReminderSMS(customerPhone, rideDetails) {
  try {
    const message = `Payment reminder: ${rideDetails.car_make} ${rideDetails.car_model} - Total due: $${rideDetails.total_cost}`;
    return await sendSMS(customerPhone, message);
  } catch (error) {
    console.error("❌ Error sending payment reminder SMS:", error.message);
    throw error;
  }
}

export async function sendRideCompletionSMS(customerPhone, rideDetails) {
  try {
    const message = `Completed! Your ${rideDetails.car_make} ${rideDetails.car_model} is ready to pick up. Thank you for choosing Marte!`;
    return await sendSMS(customerPhone, message);
  } catch (error) {
    console.error("❌ Error sending completion SMS:", error.message);
    throw error;
  }
}

export async function sendRideRequestNotificationToAdmin(
  adminPhone,
  rideDetails,
) {
  try {
    const fullName = `${rideDetails.first_name} ${rideDetails.last_name}`;
    const pickupDate = new Date(rideDetails.pickup_date).toLocaleDateString(
      "en-US",
      { weekday: "short", month: "short", day: "numeric" },
    );
    const pickupTime = formatTimeToAmPm(rideDetails.pickup_time);
    const message = `📍 NEW RIDE REQUEST: ${fullName} | ${rideDetails.phone_number} | Pickup: ${rideDetails.pickup_location} → ${rideDetails.dropoff_location} | ${pickupDate} at ${pickupTime} | Log in to confirm: https://marteluxurycarservice.com/admin`;
    return await sendSMS(adminPhone, message);
  } catch (error) {
    console.error("❌ Error sending admin notification SMS:", error.message);
    throw error;
  }
}

export async function sendRideConfirmationToCustomer(
  customerPhone,
  rideDetails,
) {
  try {
    const message = `Thank you for requesting your ride with Marte Luxury Car Service. Your request has been received, and you will receive a quote for the ride shortly.`;
    return await sendSMS(customerPhone, message);
  } catch (error) {
    console.error("❌ Error sending confirmation SMS:", error.message);
    throw error;
  }
}

// Notify admin that customer accepted the price quote
export async function sendCustomerConfirmedNotificationToAdmin(
  adminPhone,
  rideDetails,
) {
  try {
    const fullName = `${rideDetails.first_name} ${rideDetails.last_name}`;
    const pickupDate = new Date(rideDetails.pickup_date).toLocaleDateString(
      "en-US",
      { weekday: "short", month: "short", day: "numeric" },
    );
    const pickupTime = formatTimeToAmPm(rideDetails.pickup_time);
    const message = `✅ CUSTOMER CONFIRMED: ${fullName} | ${rideDetails.phone_number} | Accepted price quote of $${rideDetails.total_cost} | Route: ${rideDetails.pickup_location} → ${rideDetails.dropoff_location} | ${pickupDate} at ${pickupTime} | Log in to complete: https://marteluxurycarservice.com/admin`;
    return await sendSMS(adminPhone, message);
  } catch (error) {
    console.error(
      "❌ Error sending customer confirmed notification SMS:",
      error.message,
    );
    throw error;
  }
}

// Notify admin that customer cancelled the ride
export async function sendCustomerCancelledNotificationToAdmin(
  adminPhone,
  rideDetails,
) {
  try {
    const fullName = `${rideDetails.first_name} ${rideDetails.last_name}`;
    const message = `❌ CUSTOMER CANCELLED: ${fullName} | ${rideDetails.phone_number} | Has declined the price quote or cancelled the ride request.`;
    return await sendSMS(adminPhone, message);
  } catch (error) {
    console.error(
      "❌ Error sending customer cancelled notification SMS:",
      error.message,
    );
    throw error;
  }
}

// Send ride cancellation notice to customer
export async function sendRideCancellationToCustomer(customerPhone) {
  try {
    const message = `Your Marte Luxury Car Service ride request has been cancelled. If you need any assistance, please call +1 (914) 906-5308 or email info@martecarservice.com.`;
    return await sendSMS(customerPhone, message);
  } catch (error) {
    console.error("❌ Error sending cancellation SMS:", error.message);
    throw error;
  }
}

// Send price quote with a link to the secure "Save your card" page
export async function sendPriceQuoteWithCardLink(customerPhone, rideDetails, cardLink) {
  try {
    const { total_cost, pickup_location, dropoff_location, pickup_date, pickup_time } = rideDetails;
    const formattedDate = new Date(pickup_date).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const formattedTime = formatTimeToAmPm(pickup_time);

    const message = `Marte Luxury Car Service quote: $${total_cost}\nFrom: ${pickup_location}\nTo: ${dropoff_location}\n${formattedDate} at ${formattedTime}\n\nTO ACCEPT: open this secure link to save your card on file (your card is not charged now): ${cardLink}\nTO DECLINE: reply CANCEL.\nPlease never text your card details.`;
    return await sendSMS(customerPhone, message);
  } catch (error) {
    console.error("❌ Error sending price quote with card link SMS:", error.message);
    throw error;
  }
}

// Notify admin that customer has saved their card on file
export async function sendCardOnFileConfirmationToAdmin(adminPhone, customerDetails) {
  try {
    const { first_name, last_name, phone_number } = customerDetails;
    const message = `✅ CARD ON FILE SAVED: ${first_name} ${last_name} | ${phone_number} | Customer accepted the quote and saved a card. Please log in to confirm the booking: https://marteluxurycarservice.com/admin`;
    return await sendSMS(adminPhone, message);
  } catch (error) {
    console.error("❌ Error sending card confirmation to admin SMS:", error.message);
    throw error;
  }
}

// Send ride confirmation to customer
export async function sendRideConfirmationSMS(customerPhone, rideDetails, confirmationCode) {
  try {
    const { pickup_location, dropoff_location, pickup_date, pickup_time } = rideDetails;
    const formattedDate = new Date(pickup_date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const formattedTime = formatTimeToAmPm(pickup_time);
    
    const message = `✅ Your Marte Luxury Car Service ride is confirmed! Confirmation #${confirmationCode} | Pickup: ${pickup_date} at ${formattedTime} | From: ${pickup_location} | To: ${dropoff_location} | We'll call you 30 min before arrival.`;
    return await sendSMS(customerPhone, message);
  } catch (error) {
    console.error("❌ Error sending ride confirmation SMS:", error.message);
    throw error;
  }
}
