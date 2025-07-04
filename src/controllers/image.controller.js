import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";
import uploadToDOSpaces from "../utils/digitalOceanSpace.js";
import Image from "../models/image.model.js";
import { convertToAvif } from "../utils/imageConversionToAvif.js";
import fs from "fs";
import path from "path";
import {generateImageWithImage} from "../utils/generategemini.js"

// Controller: Upload an image with metadata
const uploadImage = asyncHandler(async (req, res) => {
  // 1. Get user info
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(401, "User authentication required");
  }

  // 2. Get file path
  const imageFile = req.files?.Image?.[0]?.path;
  if (!imageFile) {
    throw new ApiError(400, "Image file is required");
  }

  const originalName = req.files?.Image?.[0]?.originalname;

  const baseName = path.parse(originalName).name;
  const avifFileName = `${baseName}.avif`;

  const imageBuffer = fs.readFileSync(imageFile);
  const avifBuffer = await convertToAvif(imageBuffer);

  // 3. Upload to DigitalOcean Spaces
  const uploadResult = await uploadToDOSpaces(avifBuffer, avifFileName);

  if (!uploadResult || !uploadResult.url) {
    throw new ApiError(500, "Error uploading image to DigitalOcean Spaces");
  }

  // 4. Get metadata from request body
  const {
    alt,
    caption,
    imgtitle,
    category,
    pageslug,
    pagetitle,
    pageDescription,
    prompt,
  } = req.body;

  // 5. Save to DB
  const imageDoc = await Image.create({
    ImageFile: uploadResult.url,
    Alt: alt,
    Caption: caption,
    ImgTitle: imgtitle,
    Category: category,
    PageSlug: pageslug,
    PageTitle: pagetitle,
    PageDescription: pageDescription,
    Prompt: prompt,
    UploadedBy: "User",
  });

  res
    .status(201)
    .json(new ApiResponse(imageDoc, 201, "Image uploaded successfully"));
});

// Controller: Get images by page
export const getHomepageImages = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 0;
  const batchSize = 45;
  let images;

  if (page === 0) {
    // First batch: Only images uploaded by User
    images = await Image.find({ UploadedBy: "User" })
      .sort({ createdAt: -1 })
      .limit(batchSize);
  } else {
    // Subsequent batches: Only images NOT uploaded by User
    images = await Image.find({ UploadedBy: { $ne: "User" } })
      .sort({ createdAt: -1 })
      .skip((page - 1) * batchSize)
      .limit(batchSize);
  }

  res
    .status(200)
    .json(new ApiResponse(images, 200, "Images fetched successfully"));
});

// Controller: Get images by a single category (max 100)
export const getImagesByCategory = asyncHandler(async (req, res) => {
  // Accept category from query (?category=Business) or body (POST)
  const category = req.query.category || req.body.category;

  if (!category) {
    throw new ApiError(400, "Category is required");
  }

  const images = await Image.find({ Category: category })
    .sort({ createdAt: -1 })
    .limit(100);

  res
    .status(200)
    .json(new ApiResponse(images, 200, "Images fetched by category"));
});

// Controller: Get image by slug with consistent similar images
export const getImageWithSimilar = asyncHandler(async (req, res) => {
  const { slug } = req.query;
  if (!slug) throw new ApiError(400, "Slug is required from backend");

  // Find the main image by slug
  const mainImage = await Image.findOne({ PageSlug: slug });
  if (!mainImage) throw new ApiError(404, "Image not found");

  // If similarImages is empty, generate and save 20 random similar images from the same category (excluding itself)
  if (!mainImage.similarImages || mainImage.similarImages.length === 0) {
    const similar = await Image.aggregate([
      { $match: { Category: mainImage.Category, _id: { $ne: mainImage._id } } },
      { $sample: { size: 20 } },
      { $project: { _id: 1 } },
    ]);
    const similarIds = similar.map((img) => img._id);
    await Image.updateOne(
      {
        _id: mainImage._id,
        $or: [
          { similarImages: { $exists: false } },
          { similarImages: { $size: 0 } },
        ],
      },
      { $set: { similarImages: similarIds } }
    );
    mainImage.similarImages = similarIds;
  }

  // Fetch similar images with sdelected fieldsss
  const similarImages = await Image.find(
    { _id: { $in: mainImage.similarImages } },
    // Only select required fields for similar images/
    {
      ImageFile: 1,
      Alt: 1,
      Caption: 1,
      ImgTitle: 1,
      Category: 1,
      PageSlug: 1,
    }
  );

  // Prepare main image data with only required fields
  const mainImageData = {
    ImageFile: mainImage.ImageFile,
    Alt: mainImage.Alt,
    Caption: mainImage.Caption,
    ImgTitle: mainImage.ImgTitle,
    Category: mainImage.Category,
    PageTitle: mainImage.PageTitle,
    PageDescription: mainImage.PageDescription,
    Prompt: mainImage.Prompt,
  };

  res.status(200).json(
    new ApiResponse(
      {
        mainImage: mainImageData,
        similarImages,
      },
      200,
      "Main image and similar images fetched successfully"
    )
  );
});

import axios from "axios";

export const downloadImage = asyncHandler(async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) {
    throw new ApiError(400, "Image URL is required");
  }

  // Get the file name from the URL
  const fileName = path.basename(imageUrl.split("?")[0]);

  // Stream the image from the remote URL
  const response = await axios.get(imageUrl, { responseType: "stream" });

  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader(
    "Content-Type",
    response.headers["content-type"] || "application/octet-stream"
  );

  response.data.pipe(res);
});

// Controller: Get all slugs with updatedAt
export const getAllSlugsWithUpdatedAt = asyncHandler(async (req, res) => {
  const slugs = await Image.find(
    {},
    { PageSlug: 1, Category: 1, updatedAt: 1, _id: 0 }
  );
  res
    .status(200)
    .json(
      new ApiResponse(slugs, 200, "Slugs with updatedAt fetched successfully")
    );
});

export const generateImage = asyncHandler(async (req, res) => {
  const { prompt } = req.body;
  const uploadedFile = req.file;

  if (!uploadedFile) {
    return res.status(400).json({
      success: false,
      error: "No image file uploaded",
    });
  }

  if (!prompt) {
    return res.status(400).json({
      success: false,
      error: "Prompt is required",
    });
  }

  // Read the uploaded file from disk
  const filePath = path.join("./public/temp", uploadedFile.filename);
  const imageBuffer = fs.readFileSync(filePath);

  // Create image object with mime typee
  const inputImage = {
    data: imageBuffer.toString("base64"),
    mimeType: uploadedFile.mimetype,
  };

  // Generate new image using your function
  const result = await generateImageWithImage(prompt, inputImage);

  console.log("result is rrrrrrrrresykt ", result)

  // Clean up: Delete the temporary fileg
  fs.unlinkSync(filePath);

  console.log(`final console log before sending is   data:${result.data.mimeType};base64,${result.data.base64}`)

  // Send response to frontend
  res.status(201).json(
    new ApiResponse(
      {
        imageBase64: `data:${result.data.mimeType};base64,${result.data.base64}`,
        mimeType: result.data.mimeType,
      },
      201,
      "Image generated successfully"
    )
  );
});

export default uploadImage;
