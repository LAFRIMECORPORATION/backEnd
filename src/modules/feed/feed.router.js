import express          from "express";
import { authenticate } from "../../middleware/authenticate.js";
import * as ctrl        from "./feed.controller.js";

const router = express.Router();

router.get("/", authenticate, ctrl.getFeed);
router.post("/read-all", authenticate, ctrl.markAllEventsRead);
router.post("/:eventId/read", authenticate, ctrl.markEventRead);

export default router;