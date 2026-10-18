import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

const frontendApi = readFileSync(
  new URL("../../LaunchPad/src/utils/api.js", import.meta.url),
  "utf8",
);
const frontendMessages = readFileSync(
  new URL("../../LaunchPad/src/pages/Messages.jsx", import.meta.url),
  "utf8",
);
const frontendAppContext = readFileSync(
  new URL("../../LaunchPad/src/context/AppContext.jsx", import.meta.url),
  "utf8",
);
const frontendProjectDetail = readFileSync(
  new URL("../../LaunchPad/src/pages/ProjectDetail.jsx", import.meta.url),
  "utf8",
);
const frontendRoutes = readFileSync(
  new URL("../../LaunchPad/src/config/routes.js", import.meta.url),
  "utf8",
);
const frontendAppRoutes = readFileSync(
  new URL("../../LaunchPad/src/routes/AppRoutes.jsx", import.meta.url),
  "utf8",
);
const messagesRouter = readFileSync(
  new URL("../src/modules/messages/messages.router.js", import.meta.url),
  "utf8",
);
const projectsRouter = readFileSync(
  new URL("../src/modules/projects/projects.router.js", import.meta.url),
  "utf8",
);

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

test("frontend messaging methods match the exposed backend contracts", () => {
  assert.match(
    frontendApi,
    /sendMessage: \(convId, text\) =>\s*api\.post\("\/messages", \{ conversationId: convId, content: text \}\)/,
  );
  assert.match(frontendApi, /markRead: \(convId\) => api\.post\(`\/conversations\/\$\{convId\}\/read`\)/);
  assert.match(messagesRouter, /router\.post\("\/messages",\s*apiLimiter,\s*validate\(sendMessageSchema\)/);
  assert.match(messagesRouter, /router\.post\("\/conversations\/:id\/read"/);
  assert.doesNotMatch(frontendApi, /mark-read/);
});

test("published-project edits use the validated PUT route and numeric-safe payload", () => {
  assert.match(frontendApi, /update: \(id, data\) => api\.put\(`\/projects\/\$\{id\}`, data\)/);
  assert.match(projectsRouter, /router\.put\("\/:id",\s*authenticate,\s*requireRole\("student","admin"\),\s*validate\(updateProjectSchema\)/);
  assert.match(frontendProjectDetail, /await projectsApi\.update\(project\.id/);
  assert.match(frontendProjectDetail, /equityPct: updatedData\.equityPct === "" \? undefined : updatedData\.equityPct/);
  assert.match(frontendProjectDetail, /growth[\s\S]*launched/);
});

test("project-detail navigation accepts id options and reloads similar projects after navigation", () => {
  assert.match(frontendRoutes, /opts\.project\?\.id \?\? opts\.projectId \?\? opts\.id/);
  assert.match(frontendProjectDetail, /navigate\("project-detail", \{ projectId: sp\.id \}\)/);
  assert.match(frontendProjectDetail, /similarLoadedRef\.current === String\(id\)/);
  assert.match(frontendProjectDetail, /String\(project\.id\) === String\(id\)/);
  assert.match(frontendProjectDetail, /similarLoadedRef\.current !== String\(id\)/);
});

test("route content is remounted when navigation changes the pathname", () => {
  assert.match(frontendAppRoutes, /const \{ pathname \} = useLocation\(\);[\s\S]*<main\s+key=\{pathname\}/);
  assert.match(frontendAppRoutes, /<Routes location=\{location\}>/);
});

test("leaving a project detail performs a full navigation and restores the destination context", () => {
  assert.match(frontendAppContext, /currentPage === "project-detail" && nextPath !== location\.pathname/);
  assert.match(frontendAppContext, /window\.location\.assign\(nextPath\)/);
  assert.match(frontendAppContext, /pendingConversation: opts\.targetUserId/);
  assert.match(frontendAppContext, /navigationHandoff\?\.project/);
  assert.match(frontendAppContext, /navigationHandoff\?\.pendingConversation/);
  assert.match(frontendAppContext, /sessionStorage\.removeItem\(NAVIGATION_HANDOFF_KEY\)/);
});

test("message unread totals have one realtime increment source", () => {
  assert.match(frontendAppContext, /socket\.on\("unread_update", handleUnreadUpdate\)/);
  assert.doesNotMatch(frontendAppContext, /socket\.on\("new_message"/);
  assert.match(frontendMessages, /socket\.on\("new_message", handleNewMessage\)/);
});
