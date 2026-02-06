import dotenv from 'dotenv';
dotenv.config();

import express from "express";
import { createServer } from 'http';
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from 'express-rate-limit';
import serverless from 'serverless-http';

import connectDB from './config/db.js';
import "./config/cloudinary.js";
import initChat from './config/chat.js';

// ROUTES
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
import notificationRoutes from './routes/notification.routes.js';

const app = express();
const httpServer = createServer(app);

// Initialize Socket.io with chat configuration
const io = initChat(httpServer);

// Make io available to routes
app.set('io', io);

// CONNECT DB
connectDB();

// MIDDLEWARES
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'http://swayam-vite-site-12345.s3-website.ap-south-1.amazonaws.com',
    'http://13.232.101.212:5173',
    'http://13.232.101.212:5174'
  ],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Simple API logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// RATE LIMIT
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

// ROUTES
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
app.use('/api/notifications', notificationRoutes);

// TEST ROUTE
app.get("/", (req, res) => {
  res.send("Server is running!");
});

// LAMBDA EXPORT
export const handler = serverless(app);

// LOCAL DEV ONLY
const PORT = process.env.PORT || 5000;

if (!process.env.AWS_EXECUTION_ENV) {
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔌 Socket.io server ready`);
  });
}
