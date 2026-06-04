import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Chargement des variables d'environnement
dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// 1. SÉCURITÉ : Configurer Helmet pour protéger les headers HTTP
app.use(helmet());

// 2. ACCÈS : Configurer CORS pour autoriser ton futur frontend React
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// 3. BODY PARSER : Permet à Express de lire et comprendre le JSON (req.body)
app.use(express.json());

// 4. ANTI-DDOS : Limiter le nombre de requêtes par IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Fenêtre de 15 minutes
  max: 100, // Limite chaque IP à 100 requêtes par fenêtre
  message: { error: 'Trop de requêtes formulées depuis cette IP, veuillez réessayer après 15 minutes.' }
});
// On applique le limiteur uniquement sur les routes de notre API
app.use('/api', limiter);

// 5. LOGGING : Un système simple et structuré pour voir passer les requêtes dans ton terminal
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] 🛰️  ${req.method} ${req.url}`);
  next();
});

// 6. ENDPOINT HEALTHCHECK : Permet de tester que le serveur tourne ET que la DB répond
// ── ENDPOINT HEALTHCHECK ──
app.get('/api/health', async (req, res, next) => {
  try {
    // Au lieu d'un SQL brut qui bug, on demande à Prisma de faire un count ou de chercher un utilisateur.
    // Si tu as nommé ta table "user" (au singulier), écris : prisma.user.count()
    // Si elle s'appelle "users", adapte le nom ci-dessous.
    await prisma.user.count(); 
    
    return res.status(200).json({
      status: 'UP',
      environment: process.env.NODE_ENV || 'development',
      database: 'CONNECTED',
      timestamp: new Date()
    });
  } catch (error) {
    // Si Neon ne répond pas, l'erreur sera interceptée proprement ici
    next(error);
  }
});

// 7. GESTIONNAIRE D'ERREURS GLOBAL : Toutes les erreurs de l'app finiront ici au format JSON
app.use((err, req, res, next) => {
  console.error('❌ Erreur détectée sur le serveur :', err.stack);

  const statusCode = err.statusCode || 500;
  
  res.status(statusCode).json({
    error: true,
    message: err.message || 'Une erreur interne du serveur est survenue.',
    // On n'affiche la pile d'erreur (stack) qu'en développement pour ne pas donner d'infos aux hackers en production
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur Launchpad démarré sur le port ${PORT} [Mode: ${process.env.NODE_ENV || 'development'}]`);
});