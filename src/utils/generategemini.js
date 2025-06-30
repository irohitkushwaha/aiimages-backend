import { GoogleGenAI, Modality } from "@google/genai";

async function generateImageWithImage(prompt, inputImage) {

    console.log("promp received is", prompt, "and input image is", inputImage)

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    try {
      // Prepare contents with both text and image
      const contents = [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: inputImage.mimeType,
                data: inputImage.data
              }
            }
          ]
        }
      ];
  
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-preview-image-generation",
        contents: contents,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });

      console.log("response received is", response)
      
      // Extract only image data from the response
      let outputImageData = null;
      let mimeType = null;
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          outputImageData = Buffer.from(part.inlineData.data, "base64");
          mimeType = part.inlineData.mimeType || "image/png";
          break; // Found the image, no need to continue
        }
      }
      
      console.log(
        "inside the gemini api call after image gen with image api call, the mimetype is",
        mimeType,
        "and image data is",
        outputImageData
      );
      
      if (!outputImageData) {
        throw new Error("No image data found in Gemini API response");
      }
      
      return {
        success: true,
        data: {
          image: outputImageData, // Return buffer data directly
          mimeType: mimeType,
          base64: outputImageData.toString('base64'), // Also provide base64 for frontend
        },
      };
    } catch (error) {
      console.log("Error generating image with image in gen api call:", error);
      console.error("Error generating image with image in gen api call:", error);
      throw new Error(
        `Failed to generate image with image in gen img api call: ${error.message}`
      );
    }
  }


  export {generateImageWithImage}