module.exports = {
  apps: [
    {
      name: 'fac-cony-api',
      cwd: '/var/www/fac-cony',
      script: 'backend/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        API_PORT: 3002
      }
    }
  ]
};
