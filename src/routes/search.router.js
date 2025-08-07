import { Router } from "express";
import {searchAiImages} from "../controllers/search.controller.js";

const router = Router();

router.route("/search").get(searchAiImages);

export default router;