import { Router } from "express";
import upload from "../middlewares/file.middleware.js";
import VerifyJWT from "../middlewares/verifyjwt.middleware.js";
import uploadImage, { generateImage } from "../controllers/image.controller.js";
import {
  getHomepageImages,
  getImageWithSimilar,
  getImagesByCategory,
  downloadImage,
  generateImage,
} from "../controllers/image.controller.js";
import { getAllSlugsWithUpdatedAt } from "../controllers/image.controller.js";

const router = Router();

//Image upload router

router.route("/upload").post(
  // VerifyJWT,
  upload.fields([{ name: "Image", maxCount: 1 }]),

  uploadImage
);

router.route("/generate").post(
  // VerifyJWT,
  upload.single("image"),

  generateImage
);

router.route("/homepage-images").get(getHomepageImages);

router.route("/images-by-category").get(getImagesByCategory);

router.route("/image-with-similar").get(getImageWithSimilar);

router.route("/download").get(downloadImage);

router.get("/slugs", getAllSlugsWithUpdatedAt);

export default router;
