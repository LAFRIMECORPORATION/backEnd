const express = require('express')
const router = express.Router();

const authenticateToken = require('./auth')
require('dotenv').config();
const pool = require("./pool")
//recuperer touts les projets avec infos utilisateurs
router.get('/', authenticateToken, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const offset = (page - 1) * limit;
    try {
        const result = await pool.query
            (`SELECT 
            projets.id,
            projets.titre,
            projets.description,
            projets.categorie,
            projets.fichier,
            projets.date_publication,
            users.username,
            users.photo_profil
            FROM projets
            JOIN users ON projets.user_id = users.id ORDER BY projets.date_publication DESC LIMIT $1 OFFSET $2`, [limit, offset]);

        res.json(result.rows)
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'erreur serveur' })
    }
})
module.exports = router;