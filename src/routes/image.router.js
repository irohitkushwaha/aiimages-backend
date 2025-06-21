import { Router } from "express";
import upload from "../middlewares/file.middleware.js";
import VerifyJWT from "../middlewares/verifyjwt.middleware.js";
import uploadImage from "../controllers/image.controller.js";
import { getHomepageImages, getImageWithSimilar, getImagesByCategory, downloadImage} from "../controllers/image.controller.js";


const router = Router();

//Image upload router

router.route("/upload").post(
  VerifyJWT,
  upload.fields([{ name: "Image", maxCount: 1 }]),

  uploadImage
);

router.route("/homepage-images").get(getHomepageImages);

router.route("/images-by-category").get(getImagesByCategory);

router.route("/image-with-similar").get(getImageWithSimilar);

router.route("/download").get(downloadImage);


export default router