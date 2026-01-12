const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DB_URL,
    ssl: {
        rejectUnauthorized: false
    }
});
pool.connect()
    .then(() => console.log("conexion a neon reussi"))
    .catch(err => console.error("erreur de conexion a neon:", err))

    module.exports = pool;