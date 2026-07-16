// ============================================================
// LAUNCHPAD — Academy Controller
// ============================================================

import * as service from "./academy.service.js";

export async function listCourses(req, res) {
  const { page = 1, limit = 20, category, level } = req.query;
  const result = await service.listCourses({ page, limit, category, level });
  res.json(result);
}

export async function getCourse(req, res) {
  const { id } = req.params;
  const course = await service.getCourseById(id);
  res.json(course);
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
