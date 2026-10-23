const express = require("express");
const { getDB, ObjectId } = require("../db");
const { randomUUID } = require("node:crypto");
const { requireAuth } = require("../middleware/auth");
const { sendEmail } = require("../utils/mailer");

let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  try {
    stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
    console.log("[Stripe] SDK initialized with configured STRIPE_SECRET_KEY");
  } catch (err) {
    console.error("[Stripe] Failed to initialize Stripe client:", err.message);
  }
}

const router = express.Router();
const TIER_LIMITS = { free: 3, pro: 9, premium: 999999 };
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const LIVE_STRIPE_ENABLED = Boolean(
  stripe &&
  process.env.STRIPE_SECRET_KEY &&
  !process.env.STRIPE_SECRET_KEY.includes("FakeTest"),
);

// POST /payments/create-checkout-session
router.post("/create-checkout-session", requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const { type, artworkId, tier } = req.body;
    const buyerEmail = req.auth.email;
    const buyerName = req.auth.name || "Collector";
    if (!LIVE_STRIPE_ENABLED && process.env.NODE_ENV === "production") {
      return res.status(503).json({ error: "Payments are not configured." });
    }
    if (!LIVE_STRIPE_ENABLED && process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({
        error: "Stripe is configured but unavailable. Check the backend configuration.",
      });
    }

    // 1. Subscription Tier Upgrade
    if (type === "subscription") {
      if (!["pro", "premium"].includes(tier)) {
        return res.status(400).json({ error: "Choose a valid subscription tier." });
      }
      const selectedTier = tier;
      const price = selectedTier === "pro" ? 9.99 : 19.99;

      if (LIVE_STRIPE_ENABLED) {
        try {
          const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [
              {
                price_data: {
                  currency: "usd",
                  product_data: {
                    name: `ArtHub ${selectedTier.toUpperCase()} Collector Membership`,
                    description: selectedTier === "pro" ? "Up to 9 artwork acquisitions per month" : "Unlimited artwork acquisitions & VIP curation",
                  },
                  unit_amount: Math.round(price * 100),
                },
                quantity: 1,
              },
            ],
            mode: "payment",
            customer_email: buyerEmail,
            metadata: {
              type: "subscription",
              tier: selectedTier,
              buyerEmail,
              buyerName,
            },
            success_url: `${FRONTEND_URL}/dashboard/user/subscription?success=true&session_id={CHECKOUT_SESSION_ID}&tier=${selectedTier}`,
            cancel_url: `${FRONTEND_URL}/dashboard/user/subscription?canceled=true`,
          });

          return res.json({
            sessionId: session.id,
            url: session.url,
            isStripeHosted: true,
            tier: selectedTier,
            price,
          });
        } catch (stripeErr) {
          console.error("[Stripe API] Subscription checkout creation failed:", stripeErr.message);
          return res.status(503).json({ error: "The payment provider is temporarily unavailable." });
        }
      }

      const sessionId = `sub_${randomUUID()}`;
      await db.collection("checkoutSessions").insertOne({
        sessionId,
        type: "subscription",
        tier: selectedTier,
        buyerEmail,
        buyerName,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      return res.json({
        sessionId,
        url: `${FRONTEND_URL}/dashboard/user/subscription?success=true&session_id=${sessionId}&tier=${selectedTier}`,
        price,
        tier: selectedTier,
        isStripeHosted: false,
        type: "subscription",
      });
    }

    // 2. Artwork Purchase Checkout
    if (type !== "purchase") return res.status(400).json({ error: "Invalid checkout type." });
    if (!artworkId) return res.status(400).json({ error: "artworkId is required" });
    const query = ObjectId.isValid(artworkId) ? { _id: new ObjectId(artworkId) } : { id: artworkId };
    const artwork = await db.collection("artworks").findOne(query);
    if (!artwork) return res.status(404).json({ error: "Artwork not found" });
    if (artwork.status !== "available") return res.status(400).json({ error: "This artwork is not available for purchase." });
    if (artwork.artistEmail && artwork.artistEmail.toLowerCase() === buyerEmail.toLowerCase()) {
      return res.status(400).json({ error: "Artists cannot purchase their own creations" });
    }

    const user = await db.collection("user").findOne({ email: buyerEmail });
    const currentTier = (user?.subscriptionTier || "free").toLowerCase();
    const maxAllowed = TIER_LIMITS[currentTier] ?? 3;
    const used = await db.collection("transactions").countDocuments({ buyerEmail, type: "purchase", status: "completed" });

    if (used >= maxAllowed) {
      return res.status(403).json({
        error: `Acquisition limit reached! Your ${currentTier.toUpperCase()} tier allows ${maxAllowed} purchases. Please upgrade your tier.`,
        upgradeRequired: true,
        currentTier,
        used,
        maxAllowed,
      });
    }

    if (LIVE_STRIPE_ENABLED) {
      try {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: artwork.title,
                  images: artwork.imageUrl || artwork.image ? [artwork.imageUrl || artwork.image] : [],
                  description: `Original artwork by ${artwork.artistName || "Independent Artist"} (${artwork.medium || "Mixed Media"}, ${artwork.year || "2026"})`,
                },
                unit_amount: Math.round(Number(artwork.price) * 100),
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          customer_email: buyerEmail,
          metadata: {
            type: "purchase",
            artworkId: artwork._id.toString(),
            artworkTitle: artwork.title,
            buyerEmail,
            buyerName,
            artistEmail: artwork.artistEmail || "",
          },
          success_url: `${FRONTEND_URL}/artworks/${artwork._id}?success=true&session_id={CHECKOUT_SESSION_ID}&artworkId=${artwork._id}`,
          cancel_url: `${FRONTEND_URL}/artworks/${artwork._id}?canceled=true`,
        });

        return res.json({
          sessionId: session.id,
          url: session.url,
          isStripeHosted: true,
          artwork,
          price: artwork.price,
        });
      } catch (stripeErr) {
        console.error("[Stripe API] Artwork checkout creation failed:", stripeErr.message);
        return res.status(503).json({ error: "The payment provider is temporarily unavailable." });
      }
    }

    const sessionId = `art_${randomUUID()}`;
    await db.collection("checkoutSessions").insertOne({
      sessionId,
      type: "purchase",
      artworkId: artwork._id.toString(),
      buyerEmail,
      buyerName,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    res.json({
      sessionId,
      url: `${FRONTEND_URL}/artworks/${artwork._id}?success=true&session_id=${sessionId}&artworkId=${artwork._id}`,
      artwork,
      price: artwork.price,
      isStripeHosted: false,
      type: "purchase",
    });
  } catch (err) {
    console.error("Create checkout session error:", err);
    res.status(500).json({ error: "Failed to initialize checkout session" });
  }
});

// POST /payments/verify-payment
router.post("/verify-payment", requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: "Checkout session ID required." });

    const existing = await db.collection("transactions").findOne({ transactionId: sessionId });
    if (existing) {
      if (existing.buyerEmail !== req.auth.email) {
        return res.status(403).json({ error: "This checkout belongs to another account." });
      }
      return res.json({ success: true, tier: existing.tier, transaction: existing });
    }

    let checkout = await db.collection("checkoutSessions").findOne({
      sessionId,
      buyerEmail: req.auth.email,
    });
    if (checkout && checkout.expiresAt <= new Date()) {
      return res.status(403).json({ error: "This checkout session has expired." });
    }

    if (!checkout && LIVE_STRIPE_ENABLED) {
      let stripeSession;
      try {
        stripeSession = await stripe.checkout.sessions.retrieve(sessionId);
      } catch (error) {
        console.warn("[Stripe API] Could not retrieve checkout session:", error.message);
        return res.status(403).json({ error: "The checkout session is invalid." });
      }

      if (
        stripeSession.payment_status !== "paid" ||
        stripeSession.mode !== "payment" ||
        stripeSession.metadata?.buyerEmail !== req.auth.email
      ) {
        return res.status(403).json({ error: "This checkout has not been paid by your account." });
      }
      checkout = { sessionId, ...stripeSession.metadata };
    }

    if (!checkout) {
      return res.status(403).json({ error: "The checkout session is invalid or belongs to another account." });
    }

    const { type, artworkId, buyerEmail, buyerName, tier } = checkout;
    if (buyerEmail !== req.auth.email) {
      return res.status(403).json({ error: "This checkout belongs to another account." });
    }

    // 1. Process Subscription Upgrade
    if (type === "subscription") {
      if (!["pro", "premium"].includes(tier)) {
        return res.status(400).json({ error: "The checkout does not contain a valid subscription tier." });
      }
      const selectedTier = tier;
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
      await db.collection("user").updateOne(
        { email: buyerEmail },
        { $set: { subscriptionTier: selectedTier, updatedAt: new Date() } }
      );
      await db.collection("checkoutSessions").deleteOne({ sessionId, buyerEmail });

      await sendEmail({
        to: buyerEmail,
        subject: `ArtHub ${selectedTier.toUpperCase()} Membership Activated!`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e1da; border-radius: 16px;">
            <h2 style="color: #e4574f;">Subscription Confirmed</h2>
            <p>Thank you for upgrading your collector plan on ArtHub.</p>
            <p><strong>Plan:</strong> ${selectedTier.toUpperCase()}</p>
            <p><strong>Amount:</strong> $${amount.toFixed(2)}/mo</p>
            <p><strong>Transaction Ref:</strong> ${txn.transactionId}</p>
            <p style="margin-top: 20px; font-size: 12px; color: #888;">ArtHub Payments · Stripe Verified</p>
          </div>
        `,
      });

      return res.json({ success: true, tier: selectedTier, transaction: txn });
    }

    // 2. Process Artwork Purchase
    if (type === "purchase" && artworkId) {
      const query = ObjectId.isValid(artworkId) ? { _id: new ObjectId(artworkId) } : { id: artworkId };
      const artwork = await db.collection("artworks").findOne(query);
      if (!artwork) return res.status(404).json({ error: "Artwork not found" });
      if (artwork.status !== "available") {
        return res.status(409).json({ error: "This artwork is no longer available." });
      }

      const buyer = await db.collection("user").findOne({ email: buyerEmail });
      const currentTier = buyer?.subscriptionTier || "free";
      const maxAllowed = TIER_LIMITS[currentTier] || TIER_LIMITS.free;
      const completedPurchases = await db.collection("transactions").countDocuments({
        buyerEmail,
        type: "purchase",
        status: "completed",
      });
      if (completedPurchases >= maxAllowed) {
        return res.status(403).json({ error: "Your purchase limit has been reached. Upgrade your membership to continue." });
      }

      const txn = {
        transactionId: sessionId || ("TXN-" + Math.floor(100000 + Math.random() * 900000)),
        type: "purchase",
        artworkId: artwork._id.toString(),
        artworkTitle: artwork.title,
        artworkImage: artwork.imageUrl || artwork.image,
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

      const soldResult = await db.collection("artworks").updateOne(
        { _id: artwork._id, status: "available" },
        { $set: { status: "sold", soldTo: buyerEmail, soldAt: new Date() } },
      );
      if (soldResult.modifiedCount === 0) {
        await db.collection("transactions").deleteOne({ transactionId: txn.transactionId });
        return res.status(409).json({ error: "This artwork has already been purchased." });
      }
      await db.collection("checkoutSessions").deleteOne({ sessionId, buyerEmail });

      await sendEmail({
        to: buyerEmail,
        subject: `Order Confirmation: ${artwork.title}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e1da; border-radius: 16px;">
            <h2 style="color: #e4574f;">Artwork Acquisition Confirmed!</h2>
            <p>Dear ${buyerName || "Collector"},</p>
            <p>Your acquisition of <strong>"${artwork.title}"</strong> by <strong>${artwork.artistName}</strong> has been successfully processed.</p>
            <div style="margin: 20px 0; padding: 15px; background-color: #f8f6f2; border-radius: 12px;">
              <p style="margin: 0;"><strong>Price Paid:</strong> $${Number(artwork.price).toLocaleString()}</p>
              <p style="margin: 5px 0 0;"><strong>Transaction ID:</strong> ${txn.transactionId}</p>
              <p style="margin: 5px 0 0;"><strong>Medium:</strong> ${artwork.medium || "Fine Art"}</p>
            </div>
            <p>You can now leave a verified review and view your piece in your <a href="${FRONTEND_URL}/dashboard/user" style="color: #e4574f;">Collector Dashboard</a>.</p>
          </div>
        `,
      });

      if (artwork.artistEmail) {
        await sendEmail({
          to: artwork.artistEmail,
          subject: `Congratulations! "${artwork.title}" has been acquired!`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e1da; border-radius: 16px;">
              <h2 style="color: #e4574f;">Artwork Sold!</h2>
              <p>Great news! Your artwork <strong>"${artwork.title}"</strong> has just been acquired by collector ${buyerName || buyerEmail}.</p>
              <p><strong>Net Proceeds:</strong> $${Number(artwork.price).toLocaleString()}</p>
              <p>Review the order in your <a href="${FRONTEND_URL}/dashboard/artist/sales" style="color: #e4574f;">Artist Studio Sales Ledger</a>.</p>
            </div>
          `,
        });
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
