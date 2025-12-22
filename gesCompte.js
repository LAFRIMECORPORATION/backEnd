
const express = require('express');
const router = express.Router()
const multer = require('multer')
const path = require('path')

require('dotenv').config();
const { Pool } = require("pg");
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});
//configuration stockage image
const storage = multer.diskStorage({
    destination: 'UPLOAD/',
    filename: (req, file, cb) => {
        const unique = Date.now() + '-'
            + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    }
})
const upload = multer({ storage: storage })
//get user info 
router.get('/users/:id', async (req, res) => {
    const userId = parseInt(req.params.id, 10)// securiser l id
    if (isNaN(userId)) {
        return res.status(404).send('id utilisateur invalide');
    }
    try {
        const result = await pool.query('SELECT  username, email, photo_profil from users WHERE id = $1', [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'utilisateur nom trouvé' })
        }
        res.json(result.rows[0])
    } catch (err) {
        console.error(err.message);
        res.status(500).send('erreur serveur')
    }
})
//put update user info + photo
router.put('/users/:id', upload.single('photo'), async (req, res) => {

    const userId = parseInt(req.params.id, 10); // conversion securisé
    if (isNaN(userId))
        return res.status(400).send('id utilisateur invalide');
    const { nom, email } = req.body
    const photo_profil = req.file ? req.file.filename : null;
    try {
        const user = await pool.query('SELECT * FROM users WHERE id = $1 ', [userId])
        if (user.rows.length === 0)
            return res.status(404).send('utilisateur non trouvé')
        let query, values;

        if (photo_profil) {
            query = 'UPDATE users SET username= $1, email= $2, photo_profil= $3 WHERE id = $4';
            values = [nom, email, photo_profil, userId]


        } else {
            query = 'UPDATE users SET useername= $1, email =$2, WHERE id = $3';
            values = [nom, email, userId]
        }
        await pool.query(query, values)
        res.send('profil mis a jour avec succes')
    } catch (err) {
        console.error('erreur put utilisateur:', err);
        res.status(500).send('erreur serveur')
    }
})
module.exports = router;