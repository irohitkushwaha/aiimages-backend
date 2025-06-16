import jwt from "jsonwebtoken";
import ApiError from "../utils/apiError.js";

const VerifyJWT = async (req, res, next) => {
  const token =
    req.cookies?.AccessToken ||
    req.header("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return next(new ApiError(401, "Missing authentication tokens"));
  }
  let user;
  try {
    user = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  } catch (error) {
    return next(
      new ApiError(401, "Access token can`t verified, so can`t authroized")
    );
  }

  req.user = user;

  next();
};

export default VerifyJWT;
