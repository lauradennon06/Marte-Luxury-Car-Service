-- Run against an existing database (db/schema.sql already includes these for fresh installs)
ALTER TABLE rides ADD COLUMN IF NOT EXISTS square_customer_id text;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS payment_link_sent_at timestamp;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS square_card_id text;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS card_brand text;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS card_last4 text;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS card_consent_at timestamp;
ALTER TABLE rides DROP COLUMN IF EXISTS square_payment_token;
ALTER TABLE rides DROP COLUMN IF EXISTS square_order_id;
DROP TABLE IF EXISTS square_webhooks;
