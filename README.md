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
- cors (^2.8.6) - Cross-Origin Resource Sharing middleware
- dotenv (^18.0.4) - Environment variable management
- stripe (^17.0.0) - Payment processing integration
- jsonwebtoken (^9.0.2) - Token generation and validation
- cryptjs (^2.4.3) - Password hashing utilities

## 🔒 Environment Variables
Configure the following in .env:
`env
PORT=5000
DB_NAME=arthub-project-db
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority
JWT_SECRET=your_jwt_secret_key_here
STRIPE_SECRET_KEY=sk_test_...
FRONTEND_URL=http://localhost:3000
`

## 🚀 Running Locally
`ash
# Install dependencies
npm install

# Seed sample data (if initial setup)
node seed.js

# Start server
node index.js
`
