
import 'dotenv/config';

import express from "express";
import { createServer } from 'http';
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';

import connectDB from './config/db.js';
import corsOptions from './config/cors.js';
import logger from './config/logger.js';
import "./config/cloudinary.js";
import './config/firebase.js';
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
import organizationAuthRoutes from './routes/organizationAuth.routes.js';
import supportRoutes from './routes/support.routes.js';
import moderationRoutes from './routes/moderation.routes.js';
import adminDataRoutes from './routes/adminData.routes.js';
import fantasyRoutes from './routes/fantasy.routes.js';
import riotRoutes from './routes/riot.routes.js';
import valorantRoutes from './routes/valorant.routes.js';
import mapVetoRoutes from './routes/mapVeto.routes.js';
import matchRoomRoutes from './routes/matchRoom.routes.js';
import resultSubmissionRoutes from './routes/resultSubmission.routes.js';

import { errorHandler } from './middleware/errorHandler.js';
import { responseHelpers } from './middleware/responseHelpers.js';

const app = express();
const httpServer = createServer(app);

// Required when running behind Nginx/ELB so req.ip and rate limiting work correctly.
app.set('trust proxy', 1);

// Initialize Socket.io with chat configuration
const io = await initChat(httpServer);

// Make io available to routes
app.set('io', io);

// CONNECT DB
connectDB();

// MIDDLEWARES
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));
app.use(compression());
app.use(cors(corsOptions)); // Centralized CORS — single source of truth

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(responseHelpers);

// Request ID + structured request logging
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const startedAt = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    logger.info('http_request', {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      userAgent: req.headers['user-agent'],
    });
  });

  next();
});

// RATE LIMIT — relaxed for production scale (per IP)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 300 : 1000, // tighter in prod, relaxed in dev
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('rate_limit_exceeded', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
    });
    res.status(429).json({
      message: 'Too many requests from this IP, please try again later',
      requestId: req.requestId,
    });
  },
});

app.use('/api/', apiLimiter);

// ============================================================================
// Health Check Endpoint — required by load balancers, monitoring, and k8s
// ============================================================================
app.get('/health', async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';

  const isHealthy = dbState === 1;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    database: dbStatus,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
    },
  });
});

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
app.use('/api/organization-auth', organizationAuthRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/admin', adminDataRoutes);
app.use('/api/fantasy', fantasyRoutes);
app.use('/api/riot', riotRoutes);
app.use('/api/valorant', valorantRoutes);
app.use('/api/map-veto', mapVetoRoutes);
app.use('/api/match-rooms', matchRoomRoutes);
app.use('/api/result-submissions', resultSubmissionRoutes);


// TEST ROUTE
app.get("/", (req, res) => {
  res.send("Server is running!");
});

// Global error handler (must be last)
app.use(errorHandler);

// ============================================================================
// LAMBDA EXPORT — only loaded when running in AWS Lambda
// ============================================================================
let handler;
if (process.env.AWS_EXECUTION_ENV) {
  const serverless = (await import('serverless-http')).default;
  handler = serverless(app);
}
export { handler };

// ============================================================================
// LOCAL / EC2 SERVER — with graceful shutdown
// ============================================================================
const PORT = process.env.PORT || 5000;

if (!process.env.AWS_EXECUTION_ENV) {
  const { startDecayCron } = await import('./cron/aegisDecay.js');
  const { startVetoWindowScheduler } = await import('./services/vetoWindowScheduler.js');

  httpServer.listen(PORT, () => {
    logger.info('server_started', { port: PORT });
    logger.info('socket_server_ready');
    startDecayCron();
    startVetoWindowScheduler(io);
  });

  // =========================================================================
  // Graceful Shutdown — cleanly close DB, sockets, and drain HTTP connections
  // =========================================================================
  const gracefulShutdown = async (signal) => {
    logger.warn('graceful_shutdown_started', { signal });

    // 1. Stop accepting new connections
    httpServer.close(() => {
      logger.info('http_server_closed');
    });

    // 2. Close Socket.IO connections
    io.close(() => {
      logger.info('socket_server_closed');
    });

    // 2.1 Close Redis adapter clients (if enabled)
    if (io.redisClients) {
      await Promise.allSettled([
        io.redisClients.redisPubClient.quit(),
        io.redisClients.redisSubClient.quit(),
      ]);
      logger.info('socket_redis_clients_closed');
    }

    // 3. Close MongoDB connection
    try {
      await mongoose.connection.close();
      logger.info('mongodb_connection_closed');
    } catch (err) {
      logger.error('mongodb_close_error', { error: err.message });
    }

    // 4. Exit
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}
