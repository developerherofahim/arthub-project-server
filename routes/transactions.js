const express = require("express");
const { getDB } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const router = express.Router();

// GET /transactions - All transactions (admin)
router.get("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const db = getDB();
    const txns = await db.collection("transactions").find({}).sort({ createdAt: -1 }).toArray();
    res.json(txns);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// GET /transactions/user/:email - User purchases
router.get("/user/:email", requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const { email } = req.params;
    if (email !== req.auth.email && req.auth.role !== "admin") {
      return res.status(403).json({ error: "You can only view your own purchases." });
    }
    const list = await db.collection("transactions").find({ buyerEmail: email, type: "purchase" }).sort({ createdAt: -1 }).toArray();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user transactions" });
  }
});

// GET /transactions/artist/:email - Artist sales
router.get("/artist/:email", requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const { email } = req.params;
    if (req.auth.role !== "admin" && (req.auth.role !== "artist" || email !== req.auth.email)) {
      return res.status(403).json({ error: "You can only view your own artist sales." });
    }
    const list = await db.collection("transactions").find({ artistEmail: email, type: "purchase" }).sort({ createdAt: -1 }).toArray();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch artist sales" });
  }
});

module.exports = router;
