import express from "express";
const app = express();
export default app;

import usersRouter from "#api/users";
import ridesRouter from "#api/rides";
import paymentsRouter from "#api/payments";
import webhooksRouter from "#api/webhooks";
import getUserFromToken from "#middleware/getUserFromToken";
import handlePostgresErrors from "#middleware/handlePostgresErrors";
import cors from "cors";
import morgan from "morgan";

app.use(cors({ origin: process.env.CORS_ORIGIN ?? /localhost/ }));

app.use(morgan("dev"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Webhook routes don't need authentication
app.use("/webhooks", webhooksRouter);

app.use(getUserFromToken);

app.get("/", (req, res) => res.send("Hello, World!"));

app.use("/users", usersRouter);
app.use("/rides", ridesRouter);
app.use("/payments", paymentsRouter);

app.use(handlePostgresErrors);
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send("Sorry! Something went wrong.");
});
