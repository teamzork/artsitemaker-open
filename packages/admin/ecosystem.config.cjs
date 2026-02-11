module.exports = {
    apps: [{
        name: 'artis-admin',
        script: './dist/server/entry.mjs',
        cwd: '/var/www/artis-admin/packages/admin',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '500M',
        env: {
            NODE_ENV: 'production',
            HOST: '127.0.0.1',
            PORT: 4322
        }
    }]
};
