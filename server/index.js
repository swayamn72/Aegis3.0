import dotenv from 'dotenv';
dotenv.config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from 'http';
import rateLimit from 'express-rate-limit';

import connectDB from './config/db.js';
import "./config/cloudinary.js";
import initChat from './config/chat.js';

import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import playerRoutes from './routes/player.routes.js';
import teamRoutes from './routes/team.routes.js';
import mobileRoutes from './routes/mobile.routes.js';
import teamTournamentRoutes from './routes/teamTournament.routes.js';
import teamApplicationRoutes from './routes/teamApplication.routes.js';
import tryoutChatRoutes from './routes/tryoutChat.routes.js';
import recruitmentRoutes from './routes/recruitment.routes.js';
import ChatRoutes from './routes/message.routes.js';
import tournamentRoutes from './routes/tournament.routes.js';
import matchRoutes from './routes/match.routes.js';
import organizationRoutes from './routes/organization.routes.js';
import orgTournamentRoutes from './routes/orgTournament.routes.js';

const app = express();
const server = createServer(app);
initChat(server);

// Connect to MongoDB
connectDB();

// Middlewares
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174'], credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Rate limiting - General API protection
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

app.use('/api/', apiLimiter);

app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});


// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/mobile', mobileRoutes);
app.use('/api/team-tournaments', teamTournamentRoutes);
app.use('/api/team-applications', teamApplicationRoutes);
app.use('/api/tryout-chats', tryoutChatRoutes);
app.use('/api/recruitment', recruitmentRoutes);
app.use('/api/chat', ChatRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/org-tournaments', orgTournamentRoutes);

// Test route
app.get("/", (req, res) => {
  res.send("Server is running!");
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
