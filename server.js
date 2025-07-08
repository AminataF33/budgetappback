import express from "express"
import cors from "cors"
import helmet from "helmet"
import morgan from "morgan"
import compression from "compression"
import rateLimit from "express-rate-limit"
import dotenv from "dotenv"

// Routes
import authRoutes from "./routes/auth.js"
import userRoutes from "./routes/users.js"
import accountRoutes from "./routes/accounts.js"
import categoryRoutes from "./routes/categories.js"
import transactionRoutes from "./routes/transactions.js"
import budgetRoutes from "./routes/budgets.js"
import goalRoutes from "./routes/goals.js"
import analyticsRoutes from "./routes/analytics.js"
import dashboardRoutes from "./routes/dashboard.js"

// Middleware
import { errorHandler } from "./middleware/errorHandler.js"
import { notFound } from "./middleware/notFound.js"

// Configuration
dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// Middleware de sécurité
app.use(helmet())
app.use(compression())

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
)

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limite chaque IP à 100 requêtes par windowMs
  message: {
    error: "Trop de requêtes depuis cette IP, réessayez dans 15 minutes.",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use(limiter)

// Middleware de parsing
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Logging
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"))
}

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  })
})

// Routes API
app.use("/api/auth", authRoutes)
app.use("/api/users", userRoutes)
app.use("/api/accounts", accountRoutes)
app.use("/api/categories", categoryRoutes)
app.use("/api/transactions", transactionRoutes)
app.use("/api/budgets", budgetRoutes)
app.use("/api/goals", goalRoutes)
app.use("/api/analytics", analyticsRoutes)
app.use("/api/dashboard", dashboardRoutes)

// Route de base
app.get("/", (req, res) => {
  res.json({
    message: "API MonBudget - Backend fonctionnel",
    version: "1.0.0",
    documentation: "/api/docs",
    endpoints: {
      auth: "/api/auth",
      users: "/api/users",
      accounts: "/api/accounts",
      categories: "/api/categories",
      transactions: "/api/transactions",
      budgets: "/api/budgets",
      goals: "/api/goals",
      analytics: "/api/analytics",
      dashboard: "/api/dashboard",
    },
  })
})

// Middleware d'erreur
app.use(notFound)
app.use(errorHandler)

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`)
  console.log(`🌍 Environnement: ${process.env.NODE_ENV || "development"}`)
  console.log(`📡 API disponible sur: http://localhost:${PORT}`)
  console.log(`🏥 Health check: http://localhost:${PORT}/health`)
})

export default app
