// pm2 process file for the VPS deployment (see docs/OPERATIONS.md).
//   pm2 start ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    {
      name: 'halve',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '600M',
      restart_delay: 2000,
      env: { NODE_ENV: 'production', PORT: '3000' },
      // .env.local is read by Next itself; put MOCK / RPC / CRON_SECRET / BLOCKED_COUNTRIES there.
      out_file: '/var/log/halve/out.log',
      error_file: '/var/log/halve/error.log',
      merge_logs: true,
      time: true,
    },
  ],
}
