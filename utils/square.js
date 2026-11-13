import { Client, Environment } from "square";
import crypto from "crypto";

export const squareEnvironment =
  process.env.SQUARE_ENV === "production"
    ? Environment.Production
    : Environment.Sandbox;

const client = new Client({
  environment: squareEnvironment,
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
});

const { customersApi, cardsApi } = client;

export { customersApi, cardsApi };

/** Public values the browser needs to render Square's card-entry form (never the access token) */
export function getWebPaymentsConfig() {
  return {
    applicationId: process.env.SQUARE_APPLICATION_ID,
    locationId: process.env.SQUARE_LOCATION_ID,
    environment: process.env.SQUARE_ENV === "production" ? "production" : "sandbox",
  };
}

function toE164(phone) {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

/**
 * Find (by phone) or create the Square customer for a booking
 * @param {object} customerData - {phone, email, firstName, lastName}
 * @returns {Promise<string>} Square customer ID
 */
export async function getOrCreateSquareCustomer(customerData) {
  const { phone, email, firstName, lastName } = customerData;
  const phoneNumber = toE164(phone);

  if (phoneNumber) {
    const search = await customersApi.searchCustomers({
      query: { filter: { phoneNumber: { exact: phoneNumber } } },
    });
    const existing = search.result.customers?.[0];
    if (existing) return existing.id;
  }

  const created = await customersApi.createCustomer({
    idempotencyKey: crypto.randomUUID(),
    givenName: firstName,
    familyName: lastName,
    phoneNumber,
    emailAddress: email || undefined,
  });

  return created.result.customer.id;
}

/**
 * Save a tokenized card (from Square's Web Payments card form) to a customer.
 * @returns {Promise<{id: string, brand: string, last4: string}>}
 */
export async function saveCardOnFile({
  customerId,
  sourceId,
  verificationToken,
  rideId,
  cardholderName,
}) {
  const response = await cardsApi.createCard({
    idempotencyKey: crypto.randomUUID(),
    sourceId,
    verificationToken: verificationToken || undefined,
    card: {
      customerId,
      referenceId: String(rideId),
      cardholderName,
    },
  });

  const { card } = response.result;
  return { id: card.id, brand: card.cardBrand, last4: card.last4 };
}

export default {
  getOrCreateSquareCustomer,
  saveCardOnFile,
  getWebPaymentsConfig,
};
