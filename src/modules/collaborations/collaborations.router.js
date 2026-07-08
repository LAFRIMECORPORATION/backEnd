import express          from "express";
import { authenticate } from "../../middleware/authenticate.js";
import * as ctrl        from "./collaborations.controller.js";

const router = express.Router();

router.use(authenticate);

router.get("/inbox",        ctrl.inbox);
router.get("/:id",          ctrl.getOne);
router.post("/",            ctrl.send);
router.put("/:id/accept",   ctrl.accept);
router.put("/:id/decline",  ctrl.decline);

export default router;