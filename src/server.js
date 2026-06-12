import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/authRoutes.js';

// Chargement des variables d'environnement
dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// 1. SÉCURITÉ : Configurer Helmet pour protéger les headers HTTP
app.use(helmet());

// 2. ACCÈS : Configuration CORS ultra-flexible (Accepte le local ET toutes les URLs Vercel automatiquement)
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    // Permet aux outils comme UptimeRobot, Postman ou le dev local sans origine de passer
    if (!origin) return callback(null, true);
    
    // Accepte si l'origine est dans la liste OU si elle se termine par .vercel.app
    if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app') || origin.includes('vercel.app')) {
      return callback(null, true);
    } else {
      return callback(new Error('Bloqué par CORS (LaFrimeCorporation Security)'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 3. BODY PARSER : Permet à Express de lire et comprendre le JSON (req.body)
app.use(express.json());

// 4. LOGGING & NETTOYAGE : Supprime les doubles slashes accidentels dans les requêtes de Vercel
app.use((req, res, next) => {
  // Si l'URL contient un double slash (ex: //auth/login), on la nettoie en interne (/auth/login)
  if (req.url.startsWith('//')) {
    req.url = req.url.replace(/^\/+/, '/');
  }
  console.log(`[${new Date().toISOString()}] 🛰️  ${req.method} ${req.url}`);
  next();
});

// 5. ANTI-DDOS : Limiter le nombre de requêtes par IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Fenêtre de 15 minutes
  max: 100, // Limite chaque IP à 100 requêtes par fenêtre
  message: { error: 'Trop de requêtes formulées depuis cette IP, veuillez réessayer après 15 minutes.' }
});
app.use('/auth', limiter); // Appliqué sur les routes d'authentification

// ── ROUTE D'ACCUEIL (Pour UptimeRobot et les tests) ──
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: "success", 
    message: "Serveur Launchpad opérationnel, réveillé et blindé ! 🔥" 
  });
});

// ── ROUTES API (Adaptées pour recevoir directement /auth/login depuis Vercel) ──
app.use('/auth', authRoutes);

// ── ENDPOINT HEALTHCHECK ──
app.get('/health', async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(200).json({
        status: 'UP',
        environment: 'production',
        database: 'DYNAMIC_LINK',
        timestamp: new Date()
      });
    }

    await prisma.user.count(); 
    return res.status(200).json({
      status: 'UP',
      environment: 'development',
      database: 'CONNECTED',
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

// 6. GESTIONNAIRE D'ERREURS GLOBAL
app.use((err, req, res, next) => {
  console.error('❌ Erreur détectée sur le serveur :', err.stack);
  const statusCode = err.statusCode || 500;
  
  res.status(statusCode).json({
    error: true,
    message: err.message || 'Une erreur interne du serveur est survenue.',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur Launchpad démarré sur le port ${PORT} [Mode: ${process.env.NODE_ENV || 'development'}]`);
});