import express          from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireKyc }   from "../../middleware/authorize.js";
import * as ctrl        from "./investor requests.controller.js";

const router = express.Router();

// Lecture publique
router.get("/",          ctrl.list);
router.get("/mine",      authenticate, ctrl.mine);
router.get("/:id",       ctrl.getOne);

// Actions authentifiées + KYC
router.post("/",              authenticate, requireKyc, ctrl.create);
router.post("/:id/apply",     authenticate, requireKyc, ctrl.apply);
router.put("/:id",            authenticate, ctrl.update);
router.delete("/:id",         authenticate, ctrl.remove);

export default router;