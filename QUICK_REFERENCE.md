# Square Payment Integration - Quick Reference

> **Outdated:** this describes an earlier payment-link design. See [PAYMENT_INTEGRATION.md](PAYMENT_INTEGRATION.md) for the current card-on-file flow.

## 🚀 Getting Started (5 minutes)

### 1. Install Dependencies
```bash
cd back-end/backend
npm install
```

### 2. Environment Setup
✅ Already configured in `.env`:
- `SQUARE_ENV=sandbox`
- `SQUARE_ACCESS_TOKEN=EAAAl0lGs8l7wgEY1Hy94mxDtVW6y0Vje-0TEWXcsY27_lLKFdU-T3FprsC0MIMV`
- `SQUARE_APPLICATION_ID=sq0idb-q0fnlH5pIFynzN8II1y_yw`
- `FRONTEND_URL=http://localhost:5173`

### 3. Update Database
```bash
npm run db:reset
```

### 4. Start Server
```bash
npm run dev
```

## 📡 API Endpoints

### Generate Payment Link (Admin Only)
```bash
POST /payments/generate-link
Authorization: Bearer [JWT_TOKEN]

Request:
{
  "rideId": 123,
  "totalCost": 75.50
}

Response:
{
  "success": true,
  "paymentLink": "https://square.link/pay/ABC123...",
  "rideId": 123
}
```

### Confirm Payment (Customer)
```bash
POST /payments/confirm-payment

Request:
{
  "rideId": 123
}

Response:
{
  "success": true,
  "message": "Payment confirmed. Admin has been notified.",
  "rideId": 123
}
```

### Webhook Endpoint
```bash
POST /payments/webhook

Receives Square events:
- payment.created
- payment.updated
- order.created
```

## 🧪 Test Card for Sandbox

```
Card Number:  4111 1111 1111 1111
Expiration:   Any future date (12/25)
CVC:          Any 3 digits (123)
Zip:          Any 5 digits (10001)
```

## 📲 SMS Messages Sent

1. **Customer Initial Request**
   - "Your request received. Quote coming soon."

2. **Customer Quote + Link**
   - "Your quote: $XX | [PAYMENT_LINK] | Questions? Call..."

3. **Admin Payment Received**
   - "✅ PAYMENT RECEIVED: [Name] | Card saved. Confirm ride?"

4. **Customer Confirmation**
   - "✅ Ride confirmed! Confirmation #[CODE]"

## 💾 Database Changes

### New Columns in `rides` table:
```sql
square_customer_id text              -- Square customer ID
square_payment_token text            -- Square payment link ID
square_order_id text                 -- Square order ID
payment_link_sent_at timestamp       -- When link was sent
```

### New Table: `square_webhooks`
```sql
id serial PRIMARY KEY
event_id text NOT NULL UNIQUE       -- Square event ID
event_type text NOT NULL            -- Type of event
ride_id integer                     -- Ride reference
payload jsonb                       -- Full webhook data
processed boolean                   -- Whether processed
created_at timestamp
```

## 🔍 Useful SQL Queries

### Check payment status for a ride
```sql
SELECT id, first_name, paid_status, square_order_id, payment_link_sent_at
FROM rides WHERE id = 123;
```

### See webhooks received
```sql
SELECT * FROM square_webhooks ORDER BY created_at DESC LIMIT 10;
```

### Find unpaid rides
```sql
SELECT id, first_name, phone_number, total_cost
FROM rides WHERE paid_status = 'unpaid';
```

## 🐛 Troubleshooting Quick Fixes

| Issue | Fix |
|-------|-----|
| Square SDK error | Run `npm install` |
| Database schema error | Run `npm run db:reset` |
| SMS not sending | Check TWILIO credentials & phone format |
| Payment link 404 | Verify SQUARE_ACCESS_TOKEN & FRONTEND_URL |
| Webhook not firing | Configure in Square Dashboard > Webhooks |

## 📂 Key Files

| File | Purpose |
|------|---------|
| `utils/square.js` | Square SDK wrapper functions |
| `db/queries/payments.js` | Database payment queries |
| `api/payments.js` | Payment API endpoints |
| `db/schema.sql` | Database schema with payment fields |
| `utils/sms.js` | SMS functions including payment messages |

## 🔐 Security Checklist

- [ ] `.env` file NOT committed to git
- [ ] Using SANDBOX credentials for testing
- [ ] SQUARE_ACCESS_TOKEN is secret
- [ ] Webhook signature verification enabled
- [ ] CORS configured for payment callback
- [ ] Database credentials secure

## 🎯 Payment Flow Summary

```
Customer requests ride
         ↓
Admin sets price → generates payment link
         ↓
Customer gets SMS with link + price
         ↓
Customer clicks link → enters card → saves with Square
         ↓
Admin gets SMS → confirms ride
         ↓
Customer gets confirmation SMS
```

## ✅ Testing Checklist

- [ ] Server running on http://localhost:3000
- [ ] Can create a ride request
- [ ] Admin can generate payment link
- [ ] Customer receives SMS with link
- [ ] Payment link opens in browser
- [ ] Test card works: 4111 1111 1111 1111
- [ ] Square shows payment completed
- [ ] Admin notified via SMS
- [ ] Admin can confirm ride
- [ ] Customer receives confirmation SMS

## 📞 Useful Links

- Square Dashboard: https://developer.squareup.com/apps
- Square Sandbox: https://squareupsandbox.com
- Square API Docs: https://developer.squareup.com/docs
- Square SDK: https://github.com/square/square-nodejs-sdk

## 🚨 Common Errors & Solutions

### Error: "SQUARE_ACCESS_TOKEN is not set"
- Check `.env` file has the token
- Restart server after updating `.env`

### Error: "Twilio API error 401"
- Verify TWILIO_ACCOUNT_SID and TWILIO_API_KEY_SECRET
- Check TWILIO_PHONE_NUMBER is correct

### Error: "Payment link creation failed"
- Verify Square token is valid in Square Dashboard
- Check internet connection
- Try again with different test data

### Error: "Webhook signature verification failed"
- Ensure SQUARE_WEBHOOK_SIGNATURE_KEY is set
- Verify it matches Square Dashboard webhook key
- Check webhook is from Square (verify header)

## 📈 What's Next?

1. Test complete payment flow
2. Build admin dashboard UI
3. Build customer payment UI
4. Monitor logs for errors
5. Set up error alerts
6. Plan production migration
7. Get production Square credentials
8. Test in production environment

## 📚 Full Documentation

- See `SQUARE_SETUP.md` for detailed setup
- See `PAYMENT_INTEGRATION.md` for technical details
- See `../SQUARE_INTEGRATION_GUIDE.md` for complete guide

---

**Status:** ✅ Ready to test!
**Environment:** 🟢 Sandbox
**Database:** ✅ Schema updated
**Credentials:** ✅ Configured
