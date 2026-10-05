const express = require("express");
const { getDB, ObjectId } = require("../db");
const router = express.Router();

const TIER_LIMITS = { free: 3, pro: 9, premium: 999999 };

// POST /payments/create-checkout-session
router.post("/create-checkout-session", async (req, res) => {
  try {
    const db = getDB();
    const { type, artworkId, buyerEmail, buyerName, tier } = req.body;
    if (!buyerEmail) return res.status(401).json({ error: "Authentication required" });

    if (type === "subscription") {
      const selectedTier = tier === "premium" ? "premium" : "pro";
      const price = selectedTier === "pro" ? 9.99 : 19.99;
      const sessionId = "sub_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
      return res.json({
        sessionId,
        url: `/dashboard/user/subscription?success=true&session_id=${sessionId}&tier=${selectedTier}`,
        price,
        tier: selectedTier,
        type: "subscription"
      });
    }

    // Artwork purchase
    if (!artworkId) return res.status(400).json({ error: "artworkId required" });
    const query = ObjectId.isValid(artworkId) ? { _id: new ObjectId(artworkId) } : { id: artworkId };
    const artwork = await db.collection("artworks").findOne(query);
    if (!artwork) return res.status(404).json({ error: "Artwork not found" });
    if (artwork.status === "sold") return res.status(400).json({ error: "Artwork already sold" });
    if (artwork.artistEmail && artwork.artistEmail.toLowerCase() === buyerEmail.toLowerCase()) {
      return res.status(400).json({ error: "You cannot purchase your own artwork" });
    }

    // Check purchase limit against user subscription tier
    const user = await db.collection("user").findOne({ email: buyerEmail });
    const currentTier = (user?.subscriptionTier || "free").toLowerCase();
    const maxAllowed = TIER_LIMITS[currentTier] ?? 3;
    const used = await db.collection("transactions").countDocuments({ buyerEmail, type: "purchase", status: "completed" });
    if (used >= maxAllowed) {
      return res.status(403).json({
        error: `Limit reached! Your ${currentTier.toUpperCase()} plan allows ${maxAllowed} purchases. Please upgrade your subscription tier.`,
        upgradeRequired: true,
        currentTier,
        used,
        maxAllowed,
      });
    }

    const sessionId = "art_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    res.json({
      sessionId,
      url: `/artworks/${artwork._id}?success=true&session_id=${sessionId}&artworkId=${artwork._id}`,
      artwork,
      price: artwork.price,
      type: "purchase"
    });
  } catch (err) {
    console.error("Payment session error:", err);
    res.status(500).json({ error: "Failed to initialize payment session" });
  }
});

// POST /payments/verify-payment
router.post("/verify-payment", async (req, res) => {
  try {
    const db = getDB();
    const { sessionId, type, artworkId, buyerEmail, buyerName, tier } = req.body;
    if (!buyerEmail) return res.status(400).json({ error: "Buyer email required" });

    const existing = await db.collection("transactions").findOne({ transactionId: sessionId });
    if (existing) return res.json({ success: true, transaction: existing });

    // Subscription upgrade
    if (type === "subscription" || tier) {
      const selectedTier = tier || "pro";
      const amount = selectedTier === "pro" ? 9.99 : 19.99;
      const txn = {
        transactionId: sessionId || ("TXN-" + Math.floor(100000 + Math.random() * 900000)),
        type: "subscription",
        tier: selectedTier,
        buyerEmail,
        buyerName: buyerName || "Collector",
        amount,
        status: "completed",
        createdAt: new Date(),
      };
      await db.collection("transactions").insertOne(txn);
      await db.collection("user").updateOne({ email: buyerEmail }, { $set: { subscriptionTier: selectedTier, updatedAt: new Date() } });
      console.log(`[SIMULATED EMAIL] To: ${buyerEmail} | Subject: ArtHub ${selectedTier.toUpperCase()} Membership Confirmed | Ref: ${txn.transactionId}`);
      return res.json({ success: true, tier: selectedTier, transaction: txn });
    }

    // Artwork purchase
    if (artworkId) {
      const query = ObjectId.isValid(artworkId) ? { _id: new ObjectId(artworkId) } : { id: artworkId };
      const artwork = await db.collection("artworks").findOne(query);
      if (!artwork) return res.status(404).json({ error: "Artwork not found" });
      const txn = {
        transactionId: sessionId || ("TXN-" + Math.floor(100000 + Math.random() * 900000)),
        type: "purchase",
        artworkId: artwork._id.toString(),
        artworkTitle: artwork.title,
        artworkImage: artwork.imageUrl,
        category: artwork.category,
        amount: artwork.price,
        buyerEmail,
        buyerName: buyerName || "Collector",
        artistId: artwork.artistId || null,
        artistName: artwork.artistName || "Artist",
        artistEmail: artwork.artistEmail || "",
        status: "completed",
        createdAt: new Date(),
      };
      await db.collection("transactions").insertOne(txn);
      // Automatic unpublish / mark sold
      await db.collection("artworks").updateOne({ _id: artwork._id }, { $set: { status: "sold", soldTo: buyerEmail, soldAt: new Date() } });
      console.log(`[SIMULATED EMAIL] To: ${buyerEmail} | Subject: Order Confirmation: ${artwork.title} | Ref: ${txn.transactionId}`);
      if (artwork.artistEmail) {
        console.log(`[SIMULATED EMAIL] To: ${artwork.artistEmail} | Subject: Artwork Sold: ${artwork.title}!`);
      }
      return res.json({ success: true, transaction: txn });
    }

    res.status(400).json({ error: "Invalid payment payload" });
  } catch (err) {
    console.error("Verify payment error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

module.exports = router;
