import mongoose, { Schema } from "mongoose";

const imageCategories = [
  "Business",
  "Finance",
  "Education & Learning",
  "Technology",
  "Festivals & occasions",
  "Fashion & beauty",
  "Travel, Lifestyle & Nature",
  "Home Design & Real Estate",
  "Food & Drink",
  "Other", // Added an 'Other' category as a fallback
];

const uploadedBySources = ["User", "GeminiAPI", "ImageGenApi"];

const ImageSchema = new Schema(
  {
    ImageFile: {
      type: String,
      required: [true, "Image file URL is required"],
      trim: true,
    },
    Alt: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    Caption: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    ImgTitle: {
      // Title specific to the image content
      type: String,
      trim: true,
      default: "",
      index: true, // Good for searching images by their content title
    },
    UploadedBy: {
      type: String,
      enum: {
        values: uploadedBySources,
        message: "UploadedBy must be one of: " + uploadedBySources.join(", "),
      },
      default: "GeminiAPI",
      index: true,
    },
    Category: {
      type: String,
      enum: {
        values: imageCategories,
        message: "Category must be one of: " + imageCategories.join(", "),
      },
      index: true,
      // required: [true, "Category is required"], // Uncomment if category is mandatory
    },
    // SEO and Page related fields
    PageSlug: {
      type: String,
      trim: true,
      unique: true, // Slugs should be unique for distinct pages
      sparse: true,
      index: true,
    },
    PageTitle: {
      type: String,
      trim: true,
    },
    PageDescription: {
      // Meta description for the HTML page
      type: String,
      trim: true,
    },
    Prompt: {
      type: String,
      trim: true,
    },
  },
  {
    similarImages: [
      {
        type: Schema.Types.ObjectId,
        ref: "Image",
      },
    ],
  },
  { timestamps: true }
);

// Optional: Add a pre-save hook to auto-generate PageSlug from ImgTitle if PageSlug is empty
ImageSchema.pre("save", function (next) {
  if (this.ImgTitle && !this.PageSlug) {
    this.PageSlug = this.ImgTitle.toLowerCase()
      .replace(/[^\w\s-]/g, "") // Remove non-word characters except spaces and hyphens
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/--+/g, "-") // Replace multiple hyphens with single - hyphen
      .trim();
  }
  next();
});

const Image = mongoose.model("Image", ImageSchema);

export default Image;
