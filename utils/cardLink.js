import jwt from "jsonwebtoken";

const PURPOSE = "save-card";
const EXPIRES_IN = "7d";

// Derived secret so a card link can never be used as a login token (and vice versa)
function secret() {
  return `${process.env.JWT_SECRET}:${PURPOSE}`;
}

/** Signed, expiring token embedded in the "Save your card" link. Bound to one ride and quote amount. */
export function createCardLinkToken(ride, totalCost) {
  return jwt.sign(
    { purpose: PURPOSE, rideId: ride.id, amount: Number(totalCost).toFixed(2) },
    secret(),
    { expiresIn: EXPIRES_IN },
  );
}

/** Returns { rideId, amount } or throws if invalid/expired */
export function verifyCardLinkToken(token) {
  const payload = jwt.verify(token, secret());
  if (payload.purpose !== PURPOSE) throw new Error("Invalid token purpose");
  return { rideId: payload.rideId, amount: payload.amount };
}

export function buildCardLinkUrl(token) {
  return `${process.env.FRONTEND_URL}/save-card/${token}`;
}
