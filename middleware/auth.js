const { createRemoteJWKSet, jwtVerify } = require("jose");
const { getDB } = require("../db");

let remoteJwks;

function getAuthIssuer() {
  const authUrl =
    process.env.BETTER_AUTH_URL ||
    process.env.FRONTEND_URL ||
    "http://localhost:3000";
  return new URL(authUrl).origin;
}

function getRemoteJwks() {
  if (!remoteJwks) {
    const jwksUrl =
      process.env.BETTER_AUTH_JWKS_URL ||
      new URL("/api/auth/jwks", getAuthIssuer()).toString();
    remoteJwks = createRemoteJWKSet(new URL(jwksUrl));
  }
  return remoteJwks;
}

async function requireAuth(req, res, next) {
  const authorization = req.get("authorization");
  const [scheme, token, ...extraParts] = (authorization || "").split(" ");

  if (
    scheme?.toLowerCase() !== "bearer" ||
    !token ||
    extraParts.length > 0
  ) {
    return res.status(401).json({ error: "A valid bearer token is required." });
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(token, getRemoteJwks(), {
      issuer: getAuthIssuer(),
      audience: getAuthIssuer(),
    }));
  } catch (error) {
    if (error instanceof TypeError) {
      console.error("Unable to contact the Better Auth JWKS endpoint:", error);
      return res.status(503).json({ error: "Authentication service unavailable." });
    }
    return res.status(401).json({ error: "The bearer token is invalid or expired." });
  }

  if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
    return res.status(401).json({ error: "The bearer token is missing user details." });
  }

  const user = await getDB().collection("user").findOne({ email: payload.email });
  if (!user) {
    return res.status(401).json({ error: "The account for this token no longer exists." });
  }

  req.auth = {
    id: payload.sub,
    email: user.email,
    name: user.name,
    image: user.image || null,
    role: user.role || "user",
    subscriptionTier: user.subscriptionTier || "free",
  };
  return next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.auth || !allowedRoles.includes(req.auth.role)) {
      return res.status(403).json({ error: "You do not have permission to do this." });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };
