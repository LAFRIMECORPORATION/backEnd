// ============================================================
// LAUNCHPAD — Academy Service
// ============================================================

import prisma from "../../config/database.js";
import { AppError } from "../../middleware/errorHandler.js";

// ── Lister les cours disponibles ────────────────────────────────
export async function listCourses({ page = 1, limit = 20, category, level }) {
  const skip = (page - 1) * limit;

  const where = {
    ...(category && { courseType: category }),
    ...(level && { level }),
  };

  const [courses, total] = await Promise.all([
    prisma.academyCourse.findMany({
      where,
      skip,
      take: limit,
      orderBy: { enrollCount: "desc" },
    }),
    prisma.academyCourse.count({ where }),
  ]);

  return {
    courses,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// ── Détail d'un cours ────────────────────────────────────────────
export async function getCourseById(id) {
  const course = await prisma.academyCourse.findUnique({
    where: { id },
    include: {
      enrollments: {
        select: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          progress: true,
          completedAt: true,
        },
        take: 5,
        orderBy: { completedAt: "desc" },
      },
    },
  });

  if (!course) {
    throw new AppError("Cours introuvable.", 404, "NOT_FOUND");
  }

  return course;
}

// ── S'inscrire à un cours ───────────────────────────────────────────
export async function enrollCourse(userId, courseId) {
  const course = await prisma.academyCourse.findUnique({
    where: { id: courseId },
  });

  if (!course) {
    throw new AppError("Cours introuvable.", 404, "NOT_FOUND");
  }

  const existing = await prisma.academyEnrollment.findUnique({
    where: {
      userId_courseId: {
        userId,
        courseId,
      },
    },
  });

  if (existing) {
    throw new AppError("Vous êtes déjà inscrit à ce cours.", 400, "ALREADY_ENROLLED");
  }

  const enrollment = await prisma.academyEnrollment.create({
    data: {
      userId,
      courseId,
      progress: 0,
    },
    include: {
      course: true,
    },
  });

  // Mettre à jour le compteur d'inscriptions
  await prisma.academyCourse.update({
    where: { id: courseId },
    data: { enrollCount: { increment: 1 } },
  });

  return enrollment;
}

// ── Obtenir les cours de l'utilisateur ────────────────────────────
export async function getUserEnrollments(userId) {
  const enrollments = await prisma.academyEnrollment.findMany({
    where: { userId },
    include: {
      course: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return enrollments;
}

// ── Mettre à jour la progression ───────────────────────────────────
export async function updateProgress(userId, courseId, progress) {
  const enrollment = await prisma.academyEnrollment.findUnique({
    where: {
      userId_courseId: {
        userId,
        courseId,
      },
    },
  });

  if (!enrollment) {
    throw new AppError("Inscription introuvable.", 404, "NOT_FOUND");
  }

  const completedAt = progress >= 100 ? new Date() : null;

  const updated = await prisma.academyEnrollment.update({
    where: {
      userId_courseId: {
        userId,
        courseId,
      },
    },
    data: {
      progress: Math.min(100, Math.max(0, progress)),
      completedAt,
    },
    include: {
      course: true,
    },
  });

  return updated;
}
