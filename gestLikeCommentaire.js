require('dotenv').config();
const express = require("express");
const router = express.Router();

const authentificateToken = require('./auth')

const { Pool } = require('pg')
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// GET likes + commentaires pour un projet
router.get('', authentificateToken, async (req, res) => {

    const projetsId = req.params.id
    const utilisateurId = req.user.id;

    try {
        // nombre de likes 
        const likesRes = await pool.query(
            'SELECT COUNT(*) AS total FROM likes WHERE projet_id = $1 ',
            [projetsId]
        );
        // est ce que l utilisateur a liké?
        const hasLikedRes = await pool.query('SELECT * FROM likes WHERE projet_id= $1 AND utilisateur_id = $2', [projetsId, utilisateurId]

        );
        // commentaires 
        const commentairesRes = await pool.query(
            'SELECT c.content, c.date_commentaire, u.nom AS nom_utilisateur FROM commentaires c JOIN users u ON c.utilisateur_id= u.id WHERE c.projet_id = $1 ORDER BY c.date_commentaire DESC',
            [projetsId]
        );
        res.json({
            likes: parseInt(likesRes.rows[0].total),
            hasLiked: hasLikedRes.rowCount > 0,
            comments: commentairesRes.rows
        });
    } catch (err) {
        res.status(500).json({ error: 'erreur serveur', detaols: err });
    }

});

// POST like/unlike
router.post('', authentificateToken, async (req, res) => {
    const projetId = req.params.id;
    const utilisateurId = req.user.id
    try {
        const existing = await pool.query('SELECT *FROM likes WHERE projet_id= $1 AND utilisateur_id = $2', [projetId, utilisateurId]

        );
        if (existing.rowCount > 0) {
            //remove like
            await pool.query('DELETE FROM likes WHERE projet_id = $1 AND utilisateur_id= $2', [projetId, utilisateurId])
        } else {
            //add like
            await pool.query('INSERT INTO likes (projet_id, utilisateur_id) VALUES($1, $2) ', [projetId, utilisateurId])
        }
        //return update data 
        const totalikes = await pool.query('SELECT COUNT(*) AS total FROM likes WHERE projet_id = $1', [projetId]);
        res.json({
            likes: parseInt(totalikes.rows[0].total),
            hasLiked: existing.rowCount === 0
        });
    } catch (err) {
        res.status(500).json({ error: 'ERREUR SERVEUR', details: err })
    }
});
//POST commentaire
router.post('', authentificateToken, async (req, res) => {
    const projetId = req.params.id
    const utilisateurId = req.user.id
    const { content } = req.body
    if (!content || content.trim() === '') {
        return res.status(400).json({ error: 'commentaire vide' });
    }
    try {
        await pool.query(
            'INSERT INTO commentaires (projet_id, utilisateur_id, content)VALUES ($1, $2, $1)', [projetId, utilisateurId, content]
        );
        const commentaireRes = await pool.query('SELECT c.comment, c.date_commentaire,u.nom AS nom_utilisateur FROM commentaires c JOIN utilisateurs u ON c.utilisateur_id = u.id WHERE c.projet_id = $1 ORDER BY c.date_commentaire DESC ', [projetId]

        );
        res.json({ comments: commentaireRes.rows })
    } catch (err) {
        res.status(500).json({ error: 'erreur serveur', details: err });
    }
    console.log('likes connectes')
}
);
module.exports = router;