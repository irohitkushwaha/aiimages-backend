import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";
import { client } from "../app.js";
import Image from "../models/image.model.js";

const searchAiImages = async (req, res) => {
  try {
    const { keyword } = req.query;

    if (!keyword || keyword.trim() === "") {
      return res.status(400).json(new ApiError(400, "Keyword is required"));
    }

    console.log("Search keyword:", keyword);

    // Static pagination - always return maximum 30 images
    const size = 30;
    const from = 0;

    const result = await client.search({
      index: "aiimages",
      body: {
        query: {
          function_score: {
            query: {
              multi_match: {
                query: keyword,
                fields: [
                  "ImgTitle^6",        // Highest priority
                  "PageTitle^5",       // Second highest
                  "Alt^4",             // Third
                  "Caption^3",         // Fourth
                  "PageDescription^2", // Fifth
                  "Prompt^1.5",        // Sixth
                  "Category^1"         // Lowest priority
                ],
                fuzziness: "AUTO", // Supports typo tolerance
                type: "best_fields"
              },
            },

            boost_mode: "multiply",
            score_mode: "multiply"
          },
        },
        from: from,
        size: size,
        sort: [
          "_score"
        ]
      },
    });

    console.log("Elasticsearch result:", result);

    const searchData = result.hits.hits;

    // Get detailed image information from MongoDB
    const detailedImages = await Promise.all(
      searchData.map(async (hit) => {
        try {
          const image = await Image.findById(hit._id).select(
            "ImageFile Alt Caption ImgTitle PageTitle PageDescription Category Prompt PageSlug createdAt updatedAt"
          );

          if (image) {
            // Add search score and relevance info
            return {
              ...image._doc,
              searchScore: hit._score,
              searchIndex: hit._index
            };
          }
          return null;
        } catch (error) {
          console.error(`Error fetching image ${hit._id}:`, error);
          return null;
        }
      })
    );

    // Filter out null values (images that couldn't be found)
    const finalResults = detailedImages.filter(item => item !== null);

    console.log(`Found ${finalResults.length} images for keyword: ${keyword}`);

    return res.status(200).json(
      new ApiResponse(
        200,
        finalResults,
        `Found ${finalResults.length} images matching "${keyword}"`
      )
    );

  } catch (error) {
    console.error("Search error:", error);
    return res.status(500).json(
      new ApiError(500, "Image search failed", error.message)
    );
  }
};

export { searchAiImages };