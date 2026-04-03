// ============================================================================
// Centralized CORS Configuration
// Single source of truth for allowed origins — used by both Express and Socket.IO
// ============================================================================

const getAllowedOrigins = () => {
  const origins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
  ];

  // Add production origins from environment
  if (process.env.CLIENT_URL) {
    origins.push(process.env.CLIENT_URL);
  }
  if (process.env.ADDITIONAL_ORIGINS) {
    origins.push(...process.env.ADDITIONAL_ORIGINS.split(',').map(o => o.trim()));
  }

  return origins;
};

export const allowedOrigins = getAllowedOrigins();

export const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
};

export default corsOptions;
