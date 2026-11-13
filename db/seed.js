import db from "#db/client";
import { createUser } from "#db/queries/users";

await db.connect();
await seed();
await db.end();
console.log("🌱 Database seeded.");

async function seed() {
  // Create admin user
  await createUser("admin", "admin123", {
    email: "admin@martecarservice.com",
    phone_number: "+1-555-0100",
    account_type: "individual",
    role: "admin",
    company_name: null,
  });

  console.log("✅ Admin account created - Username: admin, Password: admin123");
}
