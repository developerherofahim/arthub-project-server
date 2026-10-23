# ArtHub – Online Art Marketplace (Backend Server)

ArtHub is a digital platform connecting art lovers, collectors, and buyers with talented artists. This repository hosts the backend Express.js REST API with MongoDB, Stripe payment integration, and role-based permissions.

## 🌐 Live URL & Repositories
- **Live Client URL:** https://arthub-project-client.vercel.app
- **Live Server URL:** https://arthub-project-server.onrender.com (or local http://localhost:5000)
- **Backend Repo:** https://github.com/fahim0867/arthub-project-server
- **Frontend Repo:** https://github.com/fahim0867/arthub-project-client

## 🔑 Admin Credentials
- **Admin Email:** admin@arthub.com
- **Admin Password:** Admin@123

## ✨ Key Features
- **Artworks Management:** Full CRUD operations for artists with search, category filtering, price range, and pagination.
- **Role-Based Access Control:** Distinct roles for user (collector), artist, and admin.
- **Verified Commenting System:** Only users who have purchased a piece can leave verified collector comments.
- **Tiered Subscriptions & Limits:** Free tier (3 purchases), Pro (.99/mo, 9 purchases), Premium (.99/mo, unlimited).
- **Payment & Checkout Flow:** Stripe checkout integration for artwork purchases and subscription tier upgrades.
- **Automatic Unpublish / Sold Badge:** Artworks automatically transition to sold status upon completed checkout.
- **Simulated Email Notifications:** Console-logged order confirmations and artist sales notifications.
- **Analytics & Visualizations:** Real-time revenue trends, category breakdown, user distribution, and artist earnings.

## 📦 NPM Packages Used
- express (^5.2.1) - Web framework for Node.js
- mongodb (^7.7.0) - Official MongoDB driver for Node.js
- jose (^6) - Verifies Better Auth JWT signatures using the public JWKS endpoint
- cors (^2.8.6) - Cross-Origin Resource Sharing middleware
- dotenv (^18.0.4) - Environment variable management
- stripe (^17.0.0) - Payment processing integration
- cryptjs (^2.4.3) - Password hashing utilities

## 🔒 Environment Variables
Configure the following in .env:
`env
PORT=5000
DB_NAME=arthub-project-db
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority
STRIPE_SECRET_KEY=sk_test_...
FRONTEND_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3000
# Optional; defaults to BETTER_AUTH_URL + /api/auth/jwks
# BETTER_AUTH_JWKS_URL=http://localhost:3000/api/auth/jwks
`

## 🔐 JWT authentication and roles

The frontend obtains a short-lived JWT from Better Auth and sends it to this
API in the `Authorization: Bearer <token>` header. `BETTER_AUTH_URL` must point
to the frontend's Better Auth server. The API verifies JWT signatures using
that server's public JWKS endpoint and loads the account's current role from
MongoDB for each authenticated request.

| Role | Access |
| --- | --- |
| `user` | Own profile, wishlist, purchases, checkout, and comments |
| `artist` | User access plus own artworks, artwork uploads, sales, and analytics |
| `admin` | Platform-wide user, artwork, transaction, and analytics management |

Public artwork browsing and top-artist endpoints do not require a token.
Dashboard guards in the frontend are only a user-experience feature; route
authorization in this API is what enforces access. New registrations may select
`user` or `artist`; an administrator must assign `admin` using the protected
role-management endpoint.

Demo checkout sessions are enabled only outside production. Production checkout
requires a valid Stripe secret key; the API will not mark a demo session as paid
when Stripe is unavailable.

## 🚀 Running Locally
`ash
# Install dependencies
npm install

# Seed sample data (if initial setup)
node seed.js

# Start server
node index.js
`
