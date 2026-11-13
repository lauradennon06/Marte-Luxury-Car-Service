# Square Payment Integration Setup Guide

> **Outdated:** this describes an earlier payment-link design. See [PAYMENT_INTEGRATION.md](PAYMENT_INTEGRATION.md) for the current card-on-file flow.

## Overview
This document explains how to set up Square payment integration for the Marte Luxury Car Service booking flow.

## Workflow Overview

```
Customer Requests Ride
       ↓
Admin receives SMS, logs in, sets price quote
       ↓
API generates Square payment link
       ↓
Customer receives SMS with price & payment link
       ↓
Customer clicks link, saves card with Square
       ↓
Admin receives SMS notifying payment is ready
       ↓
Admin logs in and confirms the ride
       ↓
Customer receives confirmation SMS
```

## Step 1: Get Square Sandbox Credentials

### Create a Square Developer Account
1. Go to https://developer.squareup.com
2. Sign up for a free developer account
3. Verify your email

### Get Your API Credentials
1. Visit https://developer.squareup.com/apps
2. Click on your default application (or create a new one)
3. Go to the **Credentials** tab
4. Under "Sandbox" section, copy:
   - **Access Token** (you'll use this as `SQUARE_ACCESS_TOKEN`)
   - Save the **Application ID** for reference

### Get Webhook Signature Key
1. In the same app dashboard, go to **Webhooks**
2. Create a new webhook endpoint or use existing one
3. Copy the **Signature Key** (you'll use this as `SQUARE_WEBHOOK_SIGNATURE_KEY`)

## Step 2: Update Environment Variables

Add these lines to your `.env` file in the backend directory:

```env
# Square Payment Integration (Sandbox)
SQUARE_ENV=sandbox
SQUARE_ACCESS_TOKEN=sq_sb_XXXXXXXXXXXXXXXXXXXXXXX
SQUARE_WEBHOOK_SIGNATURE_KEY=whsig_XXXXXXXXXXXXXXXXXXXXXXX
FRONTEND_URL=http://localhost:5173
```

Replace the placeholder values with your actual credentials.

## Step 3: Install Dependencies

```bash
cd back-end/backend
npm install
```

This will install the Square SDK and update package-lock.json.

## Step 4: Update Database Schema

Run the database migration to add new columns for Square integration:

```bash
npm run db:reset
```

This will:
- Create the `square_webhooks` table
- Add columns to `rides` table:
  - `square_customer_id` - Square's customer identifier
  - `square_payment_token` - Square payment link ID
  - `square_order_id` - Square order identifier
  - `payment_link_sent_at` - Timestamp when payment link was sent

## Step 5: Test the Integration

### Testing Flow
1. **Customer requests a ride** via the frontend
2. **Admin receives SMS** with notification
3. **Admin logs in** to admin dashboard
4. **Admin sets price** and clicks "Send Payment Link"
5. **Customer receives SMS** with payment link and price
6. **Customer clicks link** and fills out payment form
7. **In Square sandbox**, use test card:
   - Card Number: `4111 1111 1111 1111`
   - Expiration: Any future date
   - CVC: Any 3 digits
8. **Admin receives confirmation SMS** when payment is received
9. **Admin confirms ride** in dashboard
10. **Customer receives confirmation SMS**

### Test Credentials (Sandbox Only)
- **Test Card:** 4111 1111 1111 1111
- **CVV:** Any 3 digits
- **Expiration:** Any future date
- **Postal Code:** Any 5 digits

## Step 6: API Endpoints

### Generate Payment Link
```
POST /payments/generate-link
Headers: Authorization: Bearer [JWT_TOKEN]
Body: {
  "rideId": 123,
  "totalCost": 75.50
}
Response: {
  "success": true,
  "paymentLink": "https://square.link/pay/...",
  "rideId": 123
}
```

### Confirm Payment Received
```
POST /payments/confirm-payment
Body: {
  "rideId": 123
}
Response: {
  "success": true,
  "message": "Payment confirmed. Admin has been notified.",
  "rideId": 123
}
```

## Step 7: SMS Messages in the Flow

### 1. Initial Request Confirmation (to customer)
"✅ Your ride request has been received! You'll receive a price quote shortly."

### 2. Price Quote with Payment Link (to customer)
"Your Marte Luxury Car Service quote: $75.50 | From: JFK Airport | To: Manhattan Hotel | Jan 15, 2025 at 2:00 PM | 💳 Secure your ride: [PAYMENT_LINK] | Questions? Call +1 (914) 906-5308"

### 3. Payment Received (to admin)
"✅ PAYMENT RECEIVED: John Smith | +1 (555) 123-4567 | Card on file saved successfully. Please log in to confirm the ride."

### 4. Ride Confirmation (to customer)
"✅ Your Marte Luxury Car Service ride is confirmed! Confirmation #ABC123 | Pickup: Jan 15 at 2:00 PM | From: JFK Airport | To: Manhattan Hotel | We'll call you 30 min before arrival."

## Step 8: Going to Production

When ready to accept real payments:

1. **Get Production Credentials:**
   - Go to Square Developer Dashboard
   - Switch from Sandbox to Production
   - Copy Production Access Token

2. **Update .env:**
   ```env
   SQUARE_ENV=production
   SQUARE_ACCESS_TOKEN=sq_XXXXXXXXXXXXXXXXXXXXXXX
   SQUARE_WEBHOOK_SIGNATURE_KEY=whsig_XXXXXXXXXXXXXXXXXXXXXXX
   ```

3. **Update Webhook Endpoint:**
   - Configure your production webhook URL in Square Dashboard
   - Use your production server URL

## Database Schema Changes

### New columns in `rides` table:
```sql
square_customer_id text          -- Square customer ID
square_payment_token text        -- Square payment link token
square_order_id text             -- Square order ID
payment_link_sent_at timestamp   -- When payment link was sent
```

### New `square_webhooks` table:
```sql
id serial PRIMARY KEY
event_id text NOT NULL UNIQUE   -- Square event ID
event_type text NOT NULL        -- Type of webhook event
ride_id integer                 -- Reference to rides table
payload jsonb                   -- Full webhook payload
processed boolean               -- Whether webhook was processed
created_at timestamp
```

## Troubleshooting

### "SQUARE_ACCESS_TOKEN not set" error
- Make sure your `.env` file has the Square credentials
- Restart your server after updating `.env`

### Payment link not sending
- Verify Twilio SMS credentials are correct
- Check that customer phone number is in valid format
- Check server logs for SMS errors

### Square webhook not firing
- Verify webhook URL is accessible from the internet
- Check webhook signature key is correct
- Ensure webhook events are enabled in Square Dashboard

## Security Notes

1. **Never commit credentials** to version control
2. **Use sandbox credentials** for development/testing
3. **Use production credentials** only in production environment
4. **Rotate credentials** regularly
5. **Enable webhook signature verification** (already implemented)
6. **Store payment tokens securely** (Square handles this)

## Support

For Square API issues:
- https://developer.squareup.com/docs

For Marte Luxury Car Service issues:
- Contact your development team

## References

- [Square Web Payments SDK](https://developer.squareup.com/reference/sdks/web/payments)
- [Square Payment Links API](https://developer.squareup.com/reference/square/payment-links-api)
- [Square Webhooks](https://developer.squareup.com/docs/webhooks/overview)
- [Square Sandbox Testing](https://developer.squareup.com/docs/devtools/sandbox)
