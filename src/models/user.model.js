import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jsonwebtoken from "jsonwebtoken";

const UserSchema = new Schema(
  {
    FullName: {
      type: String,
      required: true,
      index: true,
    },
    Email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    Password: {
      type: String,
      select: false,
    },
    Avatar: {
      type: String, //digital ocean spaces or from google profile
      index: true,
    },
    RefreshToken: {
      type: String,
    },
  },
  { timestamps: true }
);

//this is for hashing password whenever first time or update password field
UserSchema.pre("save", async function (next) {
  if (this.isModified("Password")) {
    this.Password = await bcrypt.hash(this.Password, 10);
    next();
  } else {
    next();
  }
});

UserSchema.methods.isPasswordCorrect = async function (Password) {
  return bcrypt.compare(Password, this.Password);
};

UserSchema.methods.generateAccessToken = async function () {
  return jsonwebtoken.sign(
    {
      _id: this._id,
      FullName: this.FullName,
      Email: this.Email,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRE,
    }
  );
};
UserSchema.methods.generateRefreshToken = async function () {
  return jsonwebtoken.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRE,
    }
  );
};

const User = mongoose.model("User", UserSchema);

export default User;
