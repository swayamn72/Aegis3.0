// PM2 Ecosystem Configuration for AWS EC2 Deployment
// Run: pm2 start ecosystem.config.cjs
// Monitor: pm2 monit
// Logs: pm2 logs aegis-api

module.exports = {
  apps: [
    {
      name: 'aegis-api',
      script: 'index.js',
      cwd: __dirname,

      // Cluster mode — use all available CPU cores
      instances: 'max',
      exec_mode: 'cluster',

      // Environment
      node_args: '--max-old-space-size=512',
      env: {
        NODE_ENV: 'development',
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },

      // Auto-restart on crashes
      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000,

      // Watch (disabled in production)
      watch: false,

      // Memory limit — restart if exceeded
      max_memory_restart: '500M',

      // Logging
      log_file: './logs/combined.log',
      error_file: './logs/error.log',
      out_file: './logs/output.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 5000,
      shutdown_with_message: true,
    },
  ],
};
