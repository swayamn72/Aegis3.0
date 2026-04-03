import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      // Connection pool — sized for 10k concurrent users
      maxPoolSize: 50,          // Max connections per process (default: 100, but 50 is optimal for shared clusters)
      minPoolSize: 10,          // Keep 10 warm connections ready
      // Timeouts
      serverSelectionTimeoutMS: 5000, // Fail fast if DB is unreachable
      socketTimeoutMS: 45000,         // Close idle sockets after 45s
      connectTimeoutMS: 10000,        // Connection attempt timeout
      // Reliability
      retryWrites: true,
      retryReads: true,
      // Performance
      compressors: ['zstd', 'snappy'], // Wire compression (reduces bandwidth to Atlas/DocumentDB)
    });

    console.log('MongoDB connected');

    // Log connection events for monitoring
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected — will auto-reconnect');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });

  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

export default connectDB;
