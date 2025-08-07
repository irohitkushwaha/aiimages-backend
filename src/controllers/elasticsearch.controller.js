import { client } from "../app.js";
import Image from "../models/image.model.js";

const createIndexes = async () => {
  try {
    const aiimagesExists = await client.indices.exists({ index: "aiimages" });
    if (!aiimagesExists) {
      await client.indices.create({
        index: "aiimages",
        body: {
          mappings: {
            properties: {
              Alt: {
                type: "text",
                fields: {
                  keyword: {
                    type: "keyword",
                  },
                },
              },
              Caption: {
                type: "text",
                fields: {
                  keyword: {
                    type: "keyword",
                  },
                },
              },
              ImgTitle: {
                type: "text",
                fields: {
                  keyword: {
                    type: "keyword",
                  },
                },
              },
              PageTitle: {
                type: "text",
                fields: {
                  keyword: {
                    type: "keyword",
                  },
                },
              },
              PageDescription: {
                type: "text",
              },
              Category: {
                type: "keyword",
              },
              Prompt: {
                type: "text",
              },
            },
          },
        },
      });
    }

    console.log("Indexes created successfully");
  } catch (error) {
    console.error("Error creating indexes:", error);
    console.log("Error creating indexes:", error);
  }
};

// Index individual image
const indexImage = async (image) => {
  try {
    await client.index({
      index: "aiimages",
      id: image._id.toString(),
      body: {
        Alt: image.Alt || "",
        Caption: image.Caption || "",
        ImgTitle: image.ImgTitle || "",
        PageTitle: image.PageTitle || "",
        PageDescription: image.PageDescription || "",
        Category: image.Category || "",
        Prompt: image.Prompt || "",
      },
    });
    
    return true;
  } catch (error) {
    console.error(`Error indexing image ${image._id}:`, error);
    return false;
  }
};

// Index all images at once
const indexAllImages = async () => {
  try {
    const images = await Image.find({});
    console.log(`Found ${images.length} images to index`);

    let successCount = 0;
    for (const image of images) {
      const success = await indexImage(image);
      if (success) successCount++;
    }

    console.log(`Successfully indexed ${successCount}/${images.length} images`);
    return { total: images.length, indexed: successCount };
  } catch (error) {
    console.error("Error indexing images:", error);
    return { error: error.message };
  }
};

export { 
  createIndexes, 
  indexImage, 
  indexAllImages
};