const express = require("express");
const { getDB } = require("../db");
const router = express.Router();

// GET /transactions - All transactions (admin)
router.get("/", async (req, res) => {
  try {
    const db = getDB();
    const txns = await db.collection("transactions").find({}).sort({ createdAt: -1 }).toArray();
    res.json(txns);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// GET /transactions/user/:email - User purchases
router.get("/user/:email", async (req, res) => {
  try {
    const db = getDB();
    const { email } = req.params;
    const list = await db.collection("transactions").find({ buyerEmail: email, type: "purchase" }).sort({ createdAt: -1 }).toArray();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user transactions" });
  }
});

// GET /transactions/artist/:email - Artist sales
router.get("/artist/:email", async (req, res) => {
  try {
    const db = getDB();
    const { email } = req.params;
    const list = await db.collection("transactions").find({ artistEmail: email, type: "purchase" }).sort({ createdAt: -1 }).toArray();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch artist sales" });
  }
});

module.exports = router;
