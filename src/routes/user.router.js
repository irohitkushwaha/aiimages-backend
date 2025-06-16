import { Router } from "express";
import upload from "../middlewares/file.middleware.js";
import {
  RegisterUser,
  LogInUser,
  RefreshingToken,
  handleGoogleToken,
} from "../controllers/user.controller.js";

const router = Router();

router.route("/register").post(
  upload.fields([{ name: "Avatar", maxCount: 1 }]),

  RegisterUser
);

router.route("/login").post(LogInUser);

//login using google
import passport from "passport";

router.route("/auth/google").get(
  passport.authenticate("google", {
    scope: ["email", "profile"],
    accessType: "offline",
    prompt: "consent",
  })
);

router.route("/auth/google/callback").get(
  passport.authenticate("google", {
    failureRedirect: "/login",
    session: false,
  }),
  handleGoogleToken
);

router.route("/refresh-token").post(RefreshingToken);

export default router;
