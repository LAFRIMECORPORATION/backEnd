// Script pour mettre à jour l'avatar de l'admin
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function updateAdminAvatar() {
  try {
    // Trouver l'utilisateur admin
    const admin = await prisma.user.findFirst({
      where: { role: 'admin' }
    });

    if (!admin) {
      console.log('Aucun utilisateur admin trouvé');
      return;
    }

    console.log('Admin trouvé:', admin.firstName, admin.lastName, admin.id);

    // Mettre à jour l'avatar avec une image par défaut ou une URL spécifique
    // Vous pouvez remplacer cette URL par l'URL de votre image
    const avatarUrl = 'https://ui-avatars.com/api/?name=adminlaunchpad&background=3B82F6&color=fff&size=200&bold=true';

    const updated = await prisma.user.update({
      where: { id: admin.id },
      data: { avatarUrl }
    });

    console.log('Avatar admin mis à jour avec succès:', updated.avatarUrl);
  } catch (error) {
    console.error('Erreur lors de la mise à jour:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateAdminAvatar();
