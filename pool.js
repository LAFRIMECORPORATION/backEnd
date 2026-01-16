import pkg from "pg"
const { Pool } = pkg;

const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_RkLl89ZbhVpo@ep-crimson-dawn-ad3xdlas-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    ssl: {
        rejectUnauthorized: false
    },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});
pool.connect()
    .then(() => console.log("conexion a neon reussi"))
    .catch(err => console.error("erreur de conexion a neon:", err))

module.exports = pool;