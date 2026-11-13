import db from "#db/client";
import bcrypt from "bcrypt";

async function createUser(username, password, userData = {}) {
  const {
    email = `${username}@martecarservice.com`,
    phone_number = "",
    account_type = "individual",
    role = "user",
    company_name = null,
  } = userData;

  const sql = `
  INSERT INTO users
    (username, email, password, phone_number, account_type, role, company_name)
  VALUES
    ($1, $2, $3, $4, $5, $6, $7)
  RETURNING *
  `;
  const hashedPassword = await bcrypt.hash(password, 10);
  const {
    rows: [user],
  } = await db.query(sql, [
    username,
    email,
    hashedPassword,
    phone_number,
    account_type,
    role,
    company_name,
  ]);
  return user;
}

export async function getUserByUsernameAndPassword(username, password) {
  const sql = `
  SELECT *
  FROM users
  WHERE username = $1
  `;
  const {
    rows: [user],
  } = await db.query(sql, [username]);
  if (!user) return null;

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) return null;

  return user;
}

export async function getUserById(id) {
  const sql = `
  SELECT *
  FROM users
  WHERE id = $1
  `;
  const {
    rows: [user],
  } = await db.query(sql, [id]);
  return user;
}

export async function getAllUsers() {
  const sql = `
  SELECT id, username, email, phone_number, account_type, company_name, created_at
  FROM users
  ORDER BY created_at DESC
  `;
  const { rows } = await db.query(sql);
  return rows;
}

export { createUser };
