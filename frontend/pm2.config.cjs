const path = require('path');
const PROJECT_ROOT = path.resolve(__dirname, '..');

module.exports = {
  apps: [
    {
      name: 'leetcode-dashboard-frontend',
      script: 'npm',
      args: ['run', 'dev'],
      cwd: path.join(PROJECT_ROOT, 'frontend'),
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      max_size: '50M',
      env: {
        NODE_ENV: 'development',
        PORT: 52107
      },
      log_file: path.join(PROJECT_ROOT, 'frontend', 'pm2.log'),
      out_file: path.join(PROJECT_ROOT, 'frontend', 'pm2.out.log'),
      error_file: path.join(PROJECT_ROOT, 'frontend', 'pm2.error.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 5000,
      listen_timeout: 30000,
      exp_backoff_restart_delay: 100
    }
  ]
};
