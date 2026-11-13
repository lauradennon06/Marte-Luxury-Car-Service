DROP TABLE IF EXISTS rides;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id serial PRIMARY KEY,
  username text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  password text NOT NULL,
  phone_number text NOT NULL,
  account_type text NOT NULL DEFAULT 'individual',
  role text NOT NULL DEFAULT 'user',
  company_name text,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rides (
  id serial PRIMARY KEY,
  user_id integer REFERENCES users(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone_number text NOT NULL,
  email text,
  pickup_location text NOT NULL,
  dropoff_location text NOT NULL,
  pickup_date date NOT NULL,
  pickup_time time NOT NULL,
  num_passengers integer NOT NULL,
  special_requests text,
  status text DEFAULT 'pending',
  paid_status text DEFAULT 'unpaid',
  total_cost numeric(10, 2),
  notes text,
  square_customer_id text,
  square_card_id text,
  card_brand text,
  card_last4 text,
  card_consent_at timestamp,
  payment_link_sent_at timestamp,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp DEFAULT CURRENT_TIMESTAMP
);
