import assert from "node:assert/strict";
import test from "node:test";
import {
  approveProjectSchema,
  rejectProjectSchema,
  adminForumQuerySchema,
} from "../src/modules/admin/admin.validation.js";
import {
  courseCommentSchema,
  courseLikeSchema,
} from "../src/modules/academy/academy.validation.js";

test("admin project approval contract uses notes", () => {
  const result = approveProjectSchema.safeParse({
    notes: "Projet approuvé après vérification.",
    featured: true,
  });

  assert.equal(result.success, true);
  assert.equal(result.data.notes, "Projet approuvé après vérification.");
  assert.equal(result.data.featured, true);
});

test("admin project rejection requires a reason", () => {
  assert.equal(rejectProjectSchema.safeParse({ reason: "Motif suffisamment détaillé." }).success, true);
  assert.equal(rejectProjectSchema.safeParse({ reason: "non" }).success, false);
});

test("Academy like contract requires a boolean desired state", () => {
  assert.deepEqual(courseLikeSchema.parse({ liked: true }), { liked: true });
  assert.equal(courseLikeSchema.safeParse({ liked: "true" }).success, false);
});

test("Academy comment contract trims content and enforces its maximum length", () => {
  assert.deepEqual(courseCommentSchema.parse({ content: "  Très bon cours.  " }), {
    content: "Très bon cours.",
  });
  assert.equal(courseCommentSchema.safeParse({ content: " ".repeat(2001) }).success, false);
});

test("admin forum query contract accepts the panel filters", () => {
  const result = adminForumQuerySchema.safeParse({
    page: "2",
    limit: "20",
    status: "deleted",
    search: "annonce",
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.data, {
    page: "2",
    limit: "20",
    status: "deleted",
    search: "annonce",
  });
});
