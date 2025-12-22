const express = require("express");
require('dotenv').config();
const router = express.Router();
const multer = require('multer')

const jwt = require('jsonwebtoken')

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });
require('dotenv').config();
const { Pool } = require('pg')
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST ,
    database:  process.env.DB_NAME,
    password:  process.env.DB_PASSWORD,
    port:  process.env.DB_PORT,
});
//middleware pour verifier le token 
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (typeof authHeader !== 'string') {
        console.log('aucun token')
        console.log("authHeader = ", authHeader)
        return res.status(401).json({ message: "token manquant" });

    }
    console.log("authHeader = ", authHeader)
    const token = authHeader.split(" ")[1].trim();
    if (!token) {
        return res.status(403).json({ error: 'token manquant' })
    }
    try {

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('token decode :', decoded)
        req.user = decoded
        console.log("decoded :", decoded)
        next();
    } catch (err) {
        console.log('cle secret :', process.env.JWT_SECRET)

        console.log('erreur jwt : ', err.message)

        return res.status(403).json({ error: 'token invalide' })
    }


}
//ajouter un projet

router.post('/publier', verifyToken, upload.single('fichier'), async (req, res) => {
    const { titre, description, categorie } = req.body
    const userId = req.user.id
    const fichier = req.file ? req.file.filename : null;
    console.log('user_id', userId)
    console.log('BODY-', req.body)
    console.log('FILE-', req.file)
    try {
        if (!fichier) {
            return res.status(400).json({ message: ' fichier manquant.' })
        }
        await pool.query(
            'INSERT INTO projets (titre, description, categorie, fichier,date_publication, user_id)VALUES ($1, $2, $3, $4, default, $5) RETURNING*', [titre, description, categorie, fichier, userId]
        );
        res.status(201).json({ message: 'projet publié succes' });
    } catch (err) {
        console.error('erreur de publication :', err);
        res.status(500).json({ message: 'erreur lors de la pubication' })
    }
})
module.exports = router;