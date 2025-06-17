import { GoogleGenAI, Type, Modality } from "@google/genai";
import { convertToAvif } from "./imageConversionToAvif.js";
import uploadToDOSpaces from "./digitalOceanSpace.js";

/**
 * Function to generate structured content using Gemini 2.5 Flash Preview
 * @param {string} keyword - The keyword to generate content for
 * @param {string} apiKey - Your Gemini API key
 * @returns {Promise<Object>} - Structured response with Alt, Caption, ImgTitle, etc.
 */
async function generateStructuredContent(keyword) {
  const ai = new GoogleGenAI(process.env.GEMINI_API_KEY2);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-05-20",
      contents: `   
      you are an image designer or who have understanding of creative image and you are expert on this, write a prompt to generate a natural & ultra high quality realistic looking image with detailing by keeping user intent on "${keyword}"

      Based on Page Title - "${keyword} image", Create SEO-optimized page meta description, image title, alt text, caption,

      Make sure all fields are relevant to the keyword and optimized for search engines.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            prompt: {
              type: Type.STRING,
            },
            pageDescription: {
              type: Type.STRING,
            },
            imgTitle: {
              type: Type.STRING,
            },
            alt: {
              type: Type.STRING,
            },
            caption: {
              type: Type.STRING,
            },
          },
          propertyOrdering: [
            "prompt",
            "pageDescription",
            "imgTitle",
            "alt",
            "caption",
          ],
        },
      },
    });

    const structuredContent = JSON.parse(response.text);

    return {
      success: true,
      data: structuredContent,
    };
  } catch (error) {
    console.error("Error generating structured content:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Function to generate images using Gemini 2.0 Flash Preview Image Generation
 * @param {string} prompt - The prompt for image generation
 * @param {string} apiKey - Your Gemini API key
 * @returns {Promise<Object>} - Response with generated image data
 */
async function generateImage(prompt, keyword) {
  const ai = new GoogleGenAI(process.env.GEMINI_API_KEY);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-preview-image-generation",
      contents: prompt,
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });

    // Extract only image data from the response
    let imageData = null;
    let mimeType = null;

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        imageData = Buffer.from(part.inlineData.data, "base64");
        mimeType = part.inlineData.mimeType || "image/png";
        break; // Found the image, no need to continue
      }
    }
    console.log(
      "inside the gemini api call after image gen api call, the mimetype is",
      mimeType,
      "and image data is",
      imageData
    );
    if (!imageData) {
      throw new Error("No image data found in Gemini API response");
    }

    const AvifBuffer = await convertToAvif(imageData);

    const fileName = `${keyword.replace(/\s+/g, "-")}.avif`;

    const imgUrl = await uploadToDOSpaces(AvifBuffer, fileName);

    return {
      success: true,
      data: {
        image: imgUrl.url, // buffer data
        mimeType: mimeType,
      },
    };
  } catch (error) {
    console.log("Error generating image in gen api call:", error);

    console.error("Error generating image in gen api call:", error);
    throw new Error(
      `Failed to generate image in gen img api call: ${error.message}`
    );
  }
}

// Export functions for use in worker
export { generateStructuredContent, generateImage };
