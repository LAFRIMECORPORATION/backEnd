import { defineConfig } from '@prisma/config';
import dotenv from 'dotenv';

// Force le chargement du fichier .env pour que process.env.DATABASE_URL soit lisible
dotenv.config();

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
});