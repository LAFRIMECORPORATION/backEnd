const express = require('express')
const router = express.Router();

const authenticateToken = require('./auth')
require('dotenv').config();
const { Pool } = require('pg')
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST ,
    database:  process.env.DB_NAME,
    password:  process.env.DB_PASSWORD,
    port:  process.env.DB_PORT,
}); 
router.get('/historique', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id // id extrait du token
        const result = await pool.query(
            'SELECT *FROM projets WHERE user_id = $1 ORDER BY date_publication DESC', [userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('erreur lors de la recuperation des projets:', error)
        res.status(500).json
            ({ message: 'erreur serveur' })
    };

})
module.exports = router;