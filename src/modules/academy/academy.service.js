// ============================================================
// LAUNCHPAD — Academy Service
// ============================================================

import prisma from "../../config/database.js";
import { AppError } from "../../middleware/errorHandler.js";

// ── Lister les cours disponibles ────────────────────────────────
export async function listCourses({ page = 1, limit = 20, category, level }) {
  const skip = (page - 1) * limit;

  // A null publishedAt is the draft marker and must never leak into the learner catalogue.
  const where = {
    publishedAt: { not: null },
    ...(category && { courseType: category }),
    ...(level && { level }),
  };

  const [courses, total] = await Promise.all([
    prisma.academyCourse.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ publishedAt: "desc" }, { enrollCount: "desc" }],
      include: {
        _count: { select: { likes: true, comments: true } },
      },
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
export async function getCourseById(id, userId = null) {
  const course = await prisma.academyCourse.findUnique({
    where: { id },
    include: {
      _count: { select: { likes: true, comments: true } },
      comments: {
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true },
          },
        },
      },
    },
  });

  if (!course || !course.publishedAt) {
    throw new AppError("Cours introuvable.", 404, "NOT_FOUND");
  }

  const liked = userId
    ? await prisma.academyCourseLike.findUnique({
        where: { userId_courseId: { userId, courseId: id } },
        select: { id: true },
      })
    : null;

  return {
    ...course,
    likesCount: course._count.likes,
    commentsCount: course._count.comments,
    likedByMe: Boolean(liked),
    comments: course.comments.map(({ user, ...comment }) => ({
      ...comment,
      user,
      author: user
        ? {
            ...user,
            name: `${user.firstName} ${user.lastName}`.trim(),
          }
        : null,
    })),
  };
}

// ── Administration du catalogue (routes admin protégées) ───────
export async function listAdminCourses() {
  const courses = await prisma.academyCourse.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { enrollments: true, likes: true, comments: true } } },
  });
  const enrollments = await prisma.academyEnrollment.count();

  return {
    courses: courses.map((course) => ({
      ...course,
      published: Boolean(course.publishedAt),
    })),
    enrollments,
  };
}

export async function createCourse(data, adminId) {
  const { published = false, ...courseData } = data;
  const publishedAt = published ? new Date() : null;

  return prisma.$transaction(async (tx) => {
    const course = await tx.academyCourse.create({
      data: { ...courseData, publishedAt },
    });
    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: "ACADEMY_COURSE_CREATED",
        entityType: "academy_course",
        entityId: course.id,
        newValues: { title: course.title, published },
      },
    });
    return { ...course, published };
  });
}

export async function updateCourse(courseId, data, adminId) {
  const existing = await prisma.academyCourse.findUnique({ where: { id: courseId } });
  if (!existing) throw new AppError("Cours introuvable.", 404, "NOT_FOUND");

  const { published, ...courseData } = data;
  const updateData = {
    ...courseData,
    ...(published === undefined
      ? {}
      : { publishedAt: published ? existing.publishedAt || new Date() : null }),
  };

  return prisma.$transaction(async (tx) => {
    const course = await tx.academyCourse.update({
      where: { id: courseId },
      data: updateData,
    });
    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: "ACADEMY_COURSE_UPDATED",
        entityType: "academy_course",
        entityId: course.id,
        oldValues: { title: existing.title, published: Boolean(existing.publishedAt) },
        newValues: { title: course.title, published: Boolean(course.publishedAt) },
      },
    });
    return { ...course, published: Boolean(course.publishedAt) };
  });
}

export async function deleteCourse(courseId, adminId) {
  const course = await prisma.academyCourse.findUnique({
    where: { id: courseId },
    select: { id: true, title: true },
  });
  if (!course) throw new AppError("Cours introuvable.", 404, "NOT_FOUND");

  await prisma.$transaction(async (tx) => {
    await tx.academyCourse.delete({ where: { id: courseId } });
    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: "ACADEMY_COURSE_DELETED",
        entityType: "academy_course",
        entityId: courseId,
        oldValues: { title: course.title },
      },
    });
  });
  return { deleted: true, courseId };
}

// ── Réactions et commentaires sur les cours publiés ────────────
export async function getUserCourseLikes(userId) {
  const likes = await prisma.academyCourseLike.findMany({
    where: { userId, course: { publishedAt: { not: null } } },
    select: { courseId: true },
  });
  return likes.map(({ courseId }) => courseId);
}

export async function setCourseLike(userId, courseId, liked) {
  const course = await prisma.academyCourse.findFirst({
    where: { id: courseId, publishedAt: { not: null } },
    select: { id: true },
  });
  if (!course) throw new AppError("Cours introuvable.", 404, "NOT_FOUND");

  if (liked) {
    await prisma.academyCourseLike.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: {},
      create: { userId, courseId },
    });
  } else {
    await prisma.academyCourseLike.deleteMany({ where: { userId, courseId } });
  }

  const likesCount = await prisma.academyCourseLike.count({ where: { courseId } });
  return { courseId, liked, likesCount };
}

export async function addCourseComment(userId, courseId, content) {
  const course = await prisma.academyCourse.findFirst({
    where: { id: courseId, publishedAt: { not: null } },
    select: { id: true },
  });
  if (!course) throw new AppError("Cours introuvable.", 404, "NOT_FOUND");

  return prisma.academyCourseComment.create({
    data: { userId, courseId, content },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, avatarUrl: true },
      },
    },
  });
}

// ── S'inscrire à un cours ───────────────────────────────────────────
export async function enrollCourse(userId, courseId) {
  const course = await prisma.academyCourse.findUnique({
    where: { id: courseId },
  });

  if (!course || !course.publishedAt) {
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
