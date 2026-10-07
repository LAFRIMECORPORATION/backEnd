import { z } from "zod";

// These contracts keep admin-only course management separate from learner interactions.
const courseFields = {
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().min(10).max(10000),
  courseType: z.string().trim().min(2).max(60),
  contentUrl: z.preprocess(
    (value) => value === "" ? null : value,
    z.string().url().refine((value) => /^https?:\/\//i.test(value)).nullable().optional(),
  ),
  isPremium: z.boolean(),
  durationMin: z.number().int().positive().max(100000).nullable(),
  level: z.string().trim().min(2).max(60),
  icon: z.string().trim().min(1).max(12),
  published: z.boolean(),
};

export const createCourseSchema = z.object({
  ...courseFields,
  isPremium: courseFields.isPremium.default(false),
  durationMin: courseFields.durationMin.default(null),
  level: courseFields.level.default("Débutant"),
  icon: courseFields.icon.default("📚"),
  published: courseFields.published.default(false),
});

export const updateCourseSchema = z.object(courseFields).partial().refine(
  (course) => Object.keys(course).length > 0,
  "Au moins un champ doit être fourni.",
);

export const courseCommentSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});

export const courseLikeSchema = z.object({
  liked: z.boolean(),
});

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map(({ path, message }) => ({
        field: path.join("."),
        message,
      }));
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: errors[0]?.message || "Données invalides.",
        errors,
      });
    }
    req.body = result.data;
    next();
  };
}
