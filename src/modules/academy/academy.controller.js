// ============================================================
// LAUNCHPAD — Academy Controller
// ============================================================

import * as service from "./academy.service.js";

export async function listCourses(req, res) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const { category, level } = req.query;
  const result = await service.listCourses({ page, limit, category, level });
  res.json(result);
}

export async function getCourse(req, res, next) {
  try {
    const { id } = req.params;
    const course = await service.getCourseById(id, req.user?.id);
    return res.json(course);
  } catch (error) {
    return next(error);
  }
}

export async function enrollCourse(req, res) {
  const { id } = req.params;
  const userId = req.user.id;
  const enrollment = await service.enrollCourse(userId, id);
  res.json(enrollment);
}

export async function getMyCourses(req, res) {
  const userId = req.user.id;
  const courses = await service.getUserEnrollments(userId);
  res.json(courses);
}

export async function updateProgress(req, res) {
  const { id } = req.params;
  const { progress } = req.body;
  const userId = req.user.id;
  const result = await service.updateProgress(userId, id, progress);
  res.json(result);
}

export async function listMyLikes(req, res, next) {
  try {
    return res.json(await service.getUserCourseLikes(req.user.id));
  } catch (error) {
    return next(error);
  }
}

export async function setLike(req, res, next) {
  try {
    return res.json(
      await service.setCourseLike(req.user.id, req.params.id, req.body.liked),
    );
  } catch (error) {
    return next(error);
  }
}

export async function addComment(req, res, next) {
  try {
    return res.status(201).json(
      await service.addCourseComment(req.user.id, req.params.id, req.body.content),
    );
  } catch (error) {
    return next(error);
  }
}

export async function listAdminCourses(req, res, next) {
  try {
    return res.json(await service.listAdminCourses());
  } catch (error) {
    return next(error);
  }
}

export async function createCourse(req, res, next) {
  try {
    return res.status(201).json(await service.createCourse(req.body, req.user.id));
  } catch (error) {
    return next(error);
  }
}

export async function updateCourse(req, res, next) {
  try {
    return res.json(
      await service.updateCourse(req.params.id, req.body, req.user.id),
    );
  } catch (error) {
    return next(error);
  }
}

export async function deleteCourse(req, res, next) {
  try {
    return res.json(await service.deleteCourse(req.params.id, req.user.id));
  } catch (error) {
    return next(error);
  }
}
