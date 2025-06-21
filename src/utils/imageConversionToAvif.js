import sharp from "sharp";

/**
 * Converts an image buffer to AVIF format with lossless quality.
 * @param {Buffer} imageBuffer The input idmage buffer.
 * @returns {Promise<Buffer>} A promise that resolves with the AVIF image buffer.
 */
export async function convertToAvif(imageBuffer) {
  try {
    const avifBuffer = await sharp(imageBuffer)
      .avif({ quality: 80 })
      .toBuffer();
    return avifBuffer;
  } catch (error) {
    console.error("Error converting image to AVIF:", error);
    throw new Error("Failed to convert image to AVIF.");
  }
}
