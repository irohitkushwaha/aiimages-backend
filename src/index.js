import dotenv from "dotenv";
dotenv.config();
import DBConnection from "./db/index.js";
import {server} from "./app.js"
DBConnection()
  .then(() => {
    server.listen(process.env.PORT || 9000, '0.0.0.0', () => {
      console.log("Service is running at port", process.env.PORT);
    });
  })
  .catch((error) => console.error("Error during server listening", error));
