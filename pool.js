const { Pool } = require("pg");

const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_RkLl89ZbhVpo@ep-crimson-dawn-ad3xdlas-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    ssl: {
        rejectUnauthorized: false
    },
    max: 3,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});
pool.on("error", (err) => {
    console.error("unexpected postgreSQL error", err)
})


module.exports = pool;