import client from "#db/client";

// Create a new ride request
export async function createRide(userId, rideData) {
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
  } = rideData;

  const result = await client.query(
    `INSERT INTO rides (user_id, first_name, last_name, phone_number, email, pickup_location, dropoff_location, pickup_date, pickup_time, num_passengers, special_requests)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      userId,
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
    ],
  );

  return result.rows[0];
}

// Get all rides for a specific user
export async function getRidesByUserId(userId) {
  const result = await client.query(
    `SELECT * FROM rides WHERE user_id = $1 ORDER BY pickup_date DESC`,
    [userId],
  );

  return result.rows;
}

// Get a single ride by ID
export async function getRideById(rideId) {
  const result = await client.query(
    `SELECT r.*, u.username
     FROM rides r
     LEFT JOIN users u ON r.user_id = u.id
     WHERE r.id = $1`,
    [rideId],
  );

  return result.rows[0];
}

// Get rides by phone number
export async function getRidesByPhoneNumber(phoneNumber) {
  const result = await client.query(
    `SELECT r.*, u.username
     FROM rides r
     LEFT JOIN users u ON r.user_id = u.id
     WHERE r.phone_number = $1
     ORDER BY r.pickup_date DESC`,
    [phoneNumber],
  );

  return result.rows;
}

// Get all rides (admin view)
export async function getAllRides(filters = {}) {
  let query = `SELECT r.*, u.username, u.company_name
               FROM rides r
               LEFT JOIN users u ON r.user_id = u.id
               WHERE 1=1`;
  const params = [];

  // Filter by status if provided
  if (filters.status) {
    params.push(filters.status);
    query += ` AND r.status = $${params.length}`;
  }

  // Filter by paid_status if provided
  if (filters.paid_status) {
    params.push(filters.paid_status);
    query += ` AND r.paid_status = $${params.length}`;
  }

  // Filter by date range if provided
  if (filters.startDate) {
    params.push(filters.startDate);
    query += ` AND r.pickup_date >= $${params.length}`;
  }

  if (filters.endDate) {
    params.push(filters.endDate);
    query += ` AND r.pickup_date <= $${params.length}`;
  }

  query += ` ORDER BY r.pickup_date DESC`;

  const result = await client.query(query, params);
  return result.rows;
}

// Update ride status (admin only)
export async function updateRideStatus(rideId, status) {
  const validStatuses = [
    "pending",
    "approved",
    "completed",
    "cancelled",
    "price_pending",
    "customer_confirmed",
  ];

  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  const result = await client.query(
    `UPDATE rides 
     SET status = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING *`,
    [status, rideId],
  );

  return result.rows[0];
}

// Update ride total cost (for price quotes)
export async function updateRideTotalCost(rideId, totalCost) {
  const result = await client.query(
    `UPDATE rides 
     SET total_cost = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING *`,
    [totalCost, rideId],
  );

  return result.rows[0];
}

// Update paid status (admin only)
export async function updatePaidStatus(rideId, paid_status) {
  const validStatuses = ["unpaid", "paid", "partially_paid", "refunded"];

  if (!validStatuses.includes(paid_status)) {
    throw new Error(`Invalid paid status: ${paid_status}`);
  }

  const result = await client.query(
    `UPDATE rides 
     SET paid_status = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING *`,
    [paid_status, rideId],
  );

  return result.rows[0];
}

// Update ride (user can update their own pending rides)
export async function updateRide(rideId, userId, updates) {
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
  } = updates;

  // Verify ride belongs to user and is still pending
  const rideCheck = await client.query(
    `SELECT * FROM rides WHERE id = $1 AND user_id = $2 AND status = 'pending'`,
    [rideId, userId],
  );

  if (rideCheck.rows.length === 0) {
    throw new Error("Ride not found or cannot be updated");
  }

  const result = await client.query(
    `UPDATE rides 
     SET first_name = COALESCE($1, first_name),
         last_name = COALESCE($2, last_name),
         phone_number = COALESCE($3, phone_number),
         email = COALESCE($4, email),
         pickup_location = COALESCE($5, pickup_location),
         dropoff_location = COALESCE($6, dropoff_location),
         pickup_date = COALESCE($7, pickup_date),
         pickup_time = COALESCE($8, pickup_time),
         num_passengers = COALESCE($9, num_passengers),
         special_requests = COALESCE($10, special_requests),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $11
     RETURNING *`,
    [
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
      rideId,
    ],
  );

  return result.rows[0];
}

// Admin-only ride update (no user_id or status restrictions)
export async function updateRideAdmin(rideId, updates) {
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
  } = updates;

  // Verify ride exists
  const rideCheck = await client.query(`SELECT * FROM rides WHERE id = $1`, [
    rideId,
  ]);

  if (rideCheck.rows.length === 0) {
    throw new Error("Ride not found");
  }

  const result = await client.query(
    `UPDATE rides 
     SET first_name = COALESCE($1, first_name),
         last_name = COALESCE($2, last_name),
         phone_number = COALESCE($3, phone_number),
         email = COALESCE($4, email),
         pickup_location = COALESCE($5, pickup_location),
         dropoff_location = COALESCE($6, dropoff_location),
         pickup_date = COALESCE($7, pickup_date),
         pickup_time = COALESCE($8, pickup_time),
         num_passengers = COALESCE($9, num_passengers),
         special_requests = COALESCE($10, special_requests),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $11
     RETURNING *`,
    [
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
      rideId,
    ],
  );

  return result.rows[0];
}

// Delete ride (user can only delete pending rides)
export async function deleteRide(rideId, userId, userRole) {
  let query;
  let params;

  if (userRole === "admin") {
    // Admins can delete any ride
    query = `DELETE FROM rides WHERE id = $1 RETURNING id`;
    params = [rideId];
  } else {
    // Regular users can only delete their own pending rides
    query = `DELETE FROM rides WHERE id = $1 AND user_id = $2 AND status = 'pending' RETURNING id`;
    params = [rideId, userId];
  }

  const result = await client.query(query, params);

  if (result.rows.length === 0) {
    throw new Error("Ride not found or cannot be deleted");
  }

  return result.rows[0];
}

// Get ride statistics (admin dashboard)
export async function getRideStatistics() {
  const result = await client.query(`
    SELECT 
      COUNT(*) as total_rides,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_rides,
      COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_rides,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_rides,
      COUNT(CASE WHEN paid_status = 'unpaid' THEN 1 END) as unpaid_rides,
      SUM(total_cost) as total_revenue
    FROM rides
  `);

  return result.rows[0];
}
