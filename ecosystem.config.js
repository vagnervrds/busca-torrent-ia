module.exports = {
  apps: [
    {
      name: 'busca-torrent-ia',
      script: './server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      // Configurações de log e rotação nativas do PM2
      output: './log/pm2-out.log',
      error: './log/pm2-error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS',
      max_size: '10M',
      retain: 3
    }
  ]
};
