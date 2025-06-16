import dotenv from "dotenv";
dotenv.config();

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import mime from "mime-types";

// Log DigitalOcean Spaces environment variables (ensure they are set in .env)
console.log("DigitalOcean Spaces ENV Variables:", {
  endpoint: process.env.DO_SPACES_ENDPOINT,
  region: process.env.DO_SPACES_REGION,
  bucketName: process.env.DO_SPACES_BUCKET_NAME,
  customCDN: process.env.DO_SPACES_CUSTOM_CDN_URL,
  accessKeyId: process.env.SPACES_KEY ? "Loaded" : "NOT LOADED",
  secretAccessKey: process.env.SPACES_SECRET ? "Loaded" : "NOT LOADED",
});

const s3Client = new S3Client({
  endpoint: `https://${process.env.DO_SPACES_ENDPOINT}`,
  region: process.env.DO_SPACES_REGION,
  credentials: {
    accessKeyId: process.env.SPACES_KEY,
    secretAccessKey: process.env.SPACES_SECRET,
  },
});

const uploadToDOSpaces = async (localFilePathOrBuffer, fileName = null, folderInSpace = "images") => {
  try {
    let fileBody;
    let contentType;
    let shouldDeleteFile = false;
    
    // Check if input is a Buffer or file path
    if (Buffer.isBuffer(localFilePathOrBuffer)) {
      // Handle buffer input
      if (!fileName) {
        console.error("fileName is required when uploading from buffer.");
        return null;
      }
      fileBody = localFilePathOrBuffer;
      contentType = mime.lookup(fileName) || "application/octet-stream";
      console.log(`Uploading buffer to DigitalOcean Spaces as: ${fileName}`);
    } else {
      // Handle file path input (existing logic)
      const localFilePath = localFilePathOrBuffer;
      
      if (!localFilePath) {
        console.error("No local file path provided for DigitalOcean Spaces upload.");
        return null;
      }

      const absolutePath = path.isAbsolute(localFilePath)
        ? localFilePath
        : path.join(process.cwd(), localFilePath);

      if (!fs.existsSync(absolutePath)) {
        console.error(`File not found at path for DigitalOcean Spaces upload: ${absolutePath}`);
        return null;
      }

      fileBody = fs.createReadStream(absolutePath);
      fileName = fileName || path.basename(absolutePath);
      contentType = mime.lookup(absolutePath) || "application/octet-stream";
      shouldDeleteFile = true;
      
      console.log(`Uploading file to DigitalOcean Spaces: ${fileName}`);
    }

    // Use the provided fileName or extracted filename
    const keyFolder = folderInSpace.endsWith('/') ? folderInSpace.slice(0, -1) : folderInSpace;
    const fileKey = `${keyFolder}/${fileName}`.replace(/\\/g, "/");

    console.log(`Uploading to DigitalOcean Spaces: ${fileKey} (Content-Type: ${contentType})`);

    const params = {
      Bucket: process.env.DO_SPACES_BUCKET_NAME,
      Key: fileKey,
      Body: fileBody,
      ACL: "public-read",
      ContentType: contentType,
    };

    const command = new PutObjectCommand(params);
    const data = await s3Client.send(command);

    // Construct the public URL using the custom CDN
    const fileUrl = `${process.env.DO_SPACES_CUSTOM_CDN_URL}/${fileKey}`;

    console.log("Successfully uploaded to DigitalOcean Spaces:", fileUrl);
    console.log("S3 Upload Data:", data);

    // Remove local file after successful upload (only if it was a file path)
    if (shouldDeleteFile && !Buffer.isBuffer(localFilePathOrBuffer)) {
      const absolutePath = path.isAbsolute(localFilePathOrBuffer)
        ? localFilePathOrBuffer
        : path.join(process.cwd(), localFilePathOrBuffer);
      fs.unlinkSync(absolutePath);
      console.log(`Successfully deleted local file: ${absolutePath}`);
    }

    return {
      url: fileUrl,
      key: fileKey,
      bucket: process.env.DO_SPACES_BUCKET_NAME,
      etag: data.ETag,
    };

  } catch (error) {
    console.error(`DigitalOcean Spaces upload error:`, {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      requestId: error.$metadata?.requestId,
    });
    return null;
  }
};

export default uploadToDOSpaces;