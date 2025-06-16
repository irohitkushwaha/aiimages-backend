import { Router } from "express";
import upload from "../middlewares/file.middleware.js";
import VerifyJWT from "../middlewares/verifyjwt.middleware.js";
import uploadImage from "../controllers/image.controller.js";

const router = Router();

//Image upload router

router.route("/upload").post(
  VerifyJWT,
  upload.fields([{ name: "Image", maxCount: 1 }]),

  uploadImage
);


export default router