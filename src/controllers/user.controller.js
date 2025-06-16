import dotenv from "dotenv";
dotenv.config();
import User from "../models/user.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";
import uploadToDOSpaces from "../utils/digitalOceanSpace.js";

const RegisterUser = asyncHandler(async (req, res) => {
  const { FullName, Email, Password } = req.body;

  if ([FullName, Email, Password].some((field) => !field)) {
    throw new ApiError(401, "All field is required");
  }

  const ExistedUser = await User.findOne({
    Email,
  });

  if (ExistedUser) {
    throw new ApiError(409, "Username or Email Already exist");
  }

  const Avatar = req.files?.Avatar?.[0]?.path;
  if (!Avatar) {
    throw new ApiError(400, "Avatar is required");
  }

  const AvatarUpload = await uploadToDOSpaces(Avatar);

  if (!AvatarUpload) {
    throw new ApiError(
      500,
      "server error while uploading avatar to DigitalOcean Spaces"
    );
  }

  const UserSaving = await User.create({
    FullName,
    Email: Email.toLowerCase(),
    Password,
    Avatar: AvatarUpload?.url,
  });

  const isUserSaved = await User.findById(UserSaving._id).select(
    "-Password -RefreshToken"
  );

  if (!isUserSaved) {
    throw new ApiError(500, "error while saving user data to database");
  }

  res.status(200).json(new ApiResponse(isUserSaved, 200));
});

const AccessRefreshTokenGenerator = async (user) => {
  const AccessToken = await user.generateAccessToken();
  const RefreshToken = await user.generateRefreshToken();
  await User.findByIdAndUpdate(
    user._id,
    {
      $set: { RefreshToken: RefreshToken },
    },
    { new: true }
  );
  return { AccessToken, RefreshToken };
};

const RefreshingToken = asyncHandler(async (req, res) => {
  console.log("Refresh token request received");
  console.log("Cookies:", req.cookies);
  console.log("Body:", req.body);

  const IncomingRefreshToken =
    req.cookies?.RefreshToken || req.body?.RefreshToken;

  console.log(
    "IncomingRefreshToken:",
    IncomingRefreshToken ? "Present" : "Missing"
  );

  if (!IncomingRefreshToken) {
    throw new ApiError(401, "refresh token is not available");
  }

  try {
    const DecodedToken = jwt.verify(
      IncomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    console.log("Token verified successfully:", DecodedToken._id);

    if (!DecodedToken) {
      throw new ApiError(401, "invalid refresh token");
    }

    const user = await User.findById(DecodedToken?._id);
    console.log("User found:", user ? "Yes" : "No");

    if (!user) {
      throw new ApiError(500, "error while calling db using decodedtoken id");
    }

    console.log("DB token:", user.RefreshToken);
    console.log("Tokens match:", IncomingRefreshToken === user.RefreshToken);

    if (IncomingRefreshToken !== user.RefreshToken) {
      throw new ApiError(401, "wrong refresh token as it doesn`t match");
    }

    const { AccessToken, RefreshToken } = await AccessRefreshTokenGenerator(
      user
    );
    console.log("New tokens generated");

    const option = {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      // secure: true, // Uncomment for HTTPS
    };

    console.log("Setting cookies and sending response");

    res
      .status(200)
      .cookie("RefreshToken", RefreshToken, option)
      .cookie("AccessToken", AccessToken, option)
      .json(new ApiResponse({}, 200, "token has been refreshed"));
  } catch (error) {
    console.log("Token verification error:", error.message);
    throw new ApiError(401, error.message || "Invalid refresh token");
  }
});

const LogInUser = asyncHandler(async (req, res) => {

  console.log(req.body)

  const { Email, Password } = req.body;

  if (!Email) {
    throw new ApiError(401, "Email is Required!");
  }

  if (!Password) {
    throw new ApiError(401, "Password is Required!");
  }

  const user = await User.findOne({ Email }).select("+Password");

  if (!user) {
    throw new ApiError(400, "Invalid email, user doesn`t exist");
  }

  const password = await user.isPasswordCorrect(Password);

  if (!password) {
    throw new ApiError(400, "Password is incorrect");
  }

  const UserData = await User.findById(user._id).select(
    "-Password -RefreshToken"
  );

  const AccessRefreshToken = await AccessRefreshTokenGenerator(user);
  console.log("AccessRefreshToken:", AccessRefreshToken);
  const option = {
    httpOnly: true,
    secure: true,
    sameSite: "None",
  };
  res
    .status(200)
    .cookie("RefreshToken", AccessRefreshToken.RefreshToken, option)
    .cookie("AccessToken", AccessRefreshToken.AccessToken, option)
    .json(new ApiResponse(UserData, 200, "Logged in Successfully"));
});

import downloadImageFromUrl from "../utils/downloadAvatarGoogle.js";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

const LoggedUsingGoogle = passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/user/auth/google/callback",
      scope: ['profile', 'email']

      // passReqToCallback: true,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value.toLowerCase();
        let user = await User.findOne({ Email: email });

        if (user) {
          // User exists, just log them in (do not update anything)
          return done(null, user);
        } else {
          // New user: handle avatar upload
          let avatarUrl = profile?.photos?.[0]?.value || "";
          let uploadedAvatarUrl = avatarUrl;

          try {
            if (avatarUrl) {
              const localFilePath = await downloadImageFromUrl(avatarUrl);
              if (localFilePath) {
                const avatarUpload = await uploadToDOSpaces(
                  localFilePath,
                  "avatars"
                );
                if (avatarUpload && avatarUpload.url) {
                  uploadedAvatarUrl = avatarUpload.url;
                }
              }
            }
          } catch (uploadError) {
            console.error("Error processing avatar:", uploadError);
            // Fallback to Google URL
          }

          user = await User.create({
            FullName: profile.displayName,
            Email: email,
            Avatar: uploadedAvatarUrl,
            // Password: not required for OAuth users
          });

          return done(null, user);
        }
      } catch (err) {
        done(err, null);
      }
    }
  )
);

const handleGoogleToken = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Google authentication - req has not user");
  }
  const user = req.user;

  const AccessRefreshToken = await AccessRefreshTokenGenerator(user);
  console.log("AccessRefreshToken:", AccessRefreshToken);
  const option = {
    httpOnly: true,
    secure: true,
    sameSite: "None",
  };

  res
    .status(200)
    .cookie("RefreshToken", AccessRefreshToken.RefreshToken, option)
    .cookie("AccessToken", AccessRefreshToken.AccessToken, option)
    .redirect("https://aigeneratedimagess.com");
});

export {
  RegisterUser,
  LogInUser,
  LoggedUsingGoogle,
  handleGoogleToken,
  RefreshingToken,
};
