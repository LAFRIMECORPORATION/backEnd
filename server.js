require("dotenv").config();
console.log("ENV", process.env.DB_URL)
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path')
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const app = express();
const publier = require('./publier')
const crudserv = require('./crudserv')
const authentificateToken = require('./auth')
const router = express.Router();
const gesCompte = require('./gesCompte')
const gesAccueil = require('./gesAccueil')
const gesHist = require('./gesHist')
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(express.json());
app.use('/api', publier);
app.use('/api', crudserv);
app.use('/api', gesCompte);
app.use('/api', gesAccueil);
app.use('/api', gesHist);

app.use('/uploads', express.static('uploads'));
app.use('/UPLOAD', express.static(path.join(__dirname, 'UPLOAD')));
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

app.get('/test-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ succes: true, time: result.row });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'BD ERROR', details: err.message })
    }
})
app.post('/Login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Veuillez remplir tous les champs" });
    }

    try {
        const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: "Utilisateur non trouvé" });
        }

        const user = userResult.rows[0];

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            alert('mot de passe incorrect')
            return res.status(401).json({ message: "Mot de passe incorrect" });

        }
        // creation du token
        const token = jwt.sign({
            id: user.id,
            nom: user.username,
            email: user.email

        }, process.env.JWT_SECRET, { expiresIn: "1h" });

        res.status(200).json({
            message: "Connexion réussie", token,


        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erreur serveur" });
    }

    console.log(req.body);
});





app.post('/signup', async (req, res) => {
    const { username, email, password, genre, numero } = req.body;
    try {
        const userExitts = await pool.query('SELECT * FROM users WHERE email = $1', [email])
        if (userExitts.rows.length > 0) {
            return res.status(400).json({ message: "cet email est deja" })
        }
        const hashedPassword = await bcrypt.hash(password, 10)


        if (!username || !email || !password || !genre || !numero) {
            return res.status(400).json({ message: 'Tous les champs sont requis.' });
        }


        const result = await pool.query(
            'INSERT INTO users (username, email, password, numero, genre, date_) VALUES ($1, $2, $3, $4, $5, default) RETURNING id',
            [username, email, hashedPassword, numero, genre]
        );

        res.status(201).json({ message: 'Inscription réussie !', userId: result.rows[0].id });
    } catch (error) {
        console.error('Erreur lors de l\'inscription :', error);
        res.status(500).json({ message: 'Erreur du serveur.' });

    }


    console.log(req.body);

});




// suivant like et commentaire

// GET likes + commentaires pour un projet
router.get('/api/projets/:id', authentificateToken, async (req, res) => {

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
router.post('/api/projets/:id/like', authentificateToken, async (req, res) => {
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
router.post('/api/projets/:id/comment', authentificateToken, async (req, res) => {
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



const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`serveur demarré sur le http://localhost:${PORT} `);
});

module.exports = router;

