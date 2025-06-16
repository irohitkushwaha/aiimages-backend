import mongoose from "mongoose";

const DBConnection = async () => {
  try {
    const ConnectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}`)
    console.log("MongoDB Connected, ConnectionInstance", ConnectionInstance.connection.host)
  } catch (error) {
    console.error("error failed during connecting to MongoDB", error);
    process.exit(1);
  }
};


export default DBConnection