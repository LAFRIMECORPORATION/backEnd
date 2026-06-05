/**
 * Script utilitaire — crée un compte admin en base.
 * Usage : node scripts/seedAdmin.js
 */
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { PrismaClient } from '../src/generated/client/index.js';

dotenv.config();

const prisma = new PrismaClient();

const ADMIN = {
  email: 'admin@launchpad.cm',
  password: 'AdminLaunchpad2026!',
  firstName: 'Admin',
  lastName: 'Launchpad',
};

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN.email } });
  if (existing) {
    console.log('✅ Compte admin déjà existant :', ADMIN.email);
    return;
  }

  const hashedPassword = await bcrypt.hash(ADMIN.password, 12);

  await prisma.user.create({
    data: {
      email: ADMIN.email,
      password: hashedPassword,
      role: 'admin',
      kycValidated: true,
      profile: {
        create: {
          firstName: ADMIN.firstName,
          lastName: ADMIN.lastName,
        },
      },
    },
  });

  console.log('✅ Admin créé');
  console.log('   Email   :', ADMIN.email);
  console.log('   Password:', ADMIN.password);
  console.log('   ⚠️  Changez ce mot de passe en production !');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
