/**
 * Transforme un User Prisma (+ profile) en objet compatible avec le frontend LaunchPad.
 */
export function formatUser(user) {
  const profile = user.profile;
  const firstName = profile?.firstName || 'Utilisateur';
  const lastName = profile?.lastName || '';
  const avatar = `${(firstName[0] || 'U').toUpperCase()}${(lastName[0] || '').toUpperCase()}`;

  const base = {
    id: user.id,
    email: user.email,
    name: `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
    role: user.role,
    avatar,
    bio: profile?.bio || undefined,
    skills: profile?.skills || [],
    kycValidated: user.kycValidated,
    kycStatus: user.kycValidated ? 'approved' : 'pending',
    reputationScore: user.reputationScore,
  };

  if (user.role === 'student') {
    base.university = profile?.university || undefined;
  }

  if (user.role === 'investor') {
    base.company = profile?.companyName || undefined;
    base.interests = profile?.skills || [];
  }

  return base;
}
