const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { connectDB } = require("./db");

const artworksRouter = require("./routes/artworks");
const usersRouter = require("./routes/users");
const paymentsRouter = require("./routes/payments");
const transactionsRouter = require("./routes/transactions");
const analyticsRouter = require("./routes/analytics");

const app = express();
const port = process.env.PORT || 5000;
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((origin) => new URL(origin.trim()).origin);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "online", service: "ArtHub API", timestamp: new Date().toISOString() });
});

app.use("/artworks", artworksRouter);
app.use("/users", usersRouter);
app.use("/payments", paymentsRouter);
app.use("/transactions", transactionsRouter);
app.use("/analytics", analyticsRouter);

app.use((req, res) => res.status(404).json({ error: "Route not found" }));
app.use((err, req, res, next) => {
  console.error("API error:", err);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

async function start() {
  try {
    await connectDB();
    app.listen(port, () => console.log(`ArtHub Server running on port ${port}`));
  } catch (err) {
    console.error("Startup failed:", err);
    process.exit(1);
  }
}
start();
