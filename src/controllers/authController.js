import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { formatUser } from '../utils/formatUser.js';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;
const TOKEN_EXPIRY = '7d';

function signToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function register(req, res, next) {
  try {
    const {
      email,
      password,
      role,
      firstName,
      lastName,
      university,
      company,
      skills = [],
    } = req.body;

    if (!email || !password || !role || !firstName || !lastName) {
      return res.status(400).json({
        error: true,
        message: 'Email, mot de passe, rôle, prénom et nom sont obligatoires.',
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: true, message: 'Adresse email invalide.' });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: true,
        message: 'Le mot de passe doit contenir au moins 8 caractères.',
      });
    }

    const cleanRole = role.toString().trim().toLowerCase();
    if (!['student', 'investor'].includes(cleanRole)) {
      return res.status(400).json({
        error: true,
        message: 'Seuls les rôles étudiant et investisseur peuvent s\'inscrire.',
      });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(409).json({ error: true, message: 'Cet email est déjà utilisé.' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        role: cleanRole,
        profile: {
          create: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            university: cleanRole === 'student' ? university?.trim() || null : null,
            companyName: cleanRole === 'investor' ? company?.trim() || null : null,
            skills: Array.isArray(skills) ? skills : [],
          },
        },
      },
      include: { profile: true },
    });

    const token = signToken(user);

    return res.status(201).json({
      user: formatUser(user),
      token,
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: true,
        message: 'Email et mot de passe sont obligatoires.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { profile: true },
    });

    if (!user) {
      return res.status(401).json({ error: true, message: 'Email ou mot de passe incorrect.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: true, message: 'Email ou mot de passe incorrect.' });
    }

    if (role) {
      const cleanRole = role.toString().trim().toLowerCase();
      if (user.role !== cleanRole) {
        return res.status(403).json({
          error: true,
          message: `Ce compte est enregistré en tant que ${user.role}, pas ${cleanRole}.`,
        });
      }
    }

    const token = signToken(user);

    return res.json({
      user: formatUser(user),
      token,
    });
  } catch (error) {
    next(error);
  }
}

export async function me(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { profile: true },
    });

    if (!user) {
      return res.status(404).json({ error: true, message: 'Utilisateur introuvable.' });
    }

    return res.json({ user: formatUser(user) });
  } catch (error) {
    next(error);
  }
}

export async function logout(req, res) {
  // JWT stateless : la déconnexion côté client suffit (suppression du token).
  return res.json({ message: 'Déconnexion réussie.' });
}
