// src/utils/downloadImage.js
import axios from "axios";
import fs from "fs";
import path from "path";

/**
 * Downloads an image from a URL to a temporary file
 * @param {string} imageUrl - URL of the image to download
 * @returns {Promise<string|null>} - Path to the downloaded file or null if failed
 */
const downloadImageFromUrl = async (imageUrl) => {
  try {
    if (!imageUrl) return null;
    
    // Create temp directory if it doesn't exist
    const tempDir = path.join(process.cwd(), "public", "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Generate a unique filename
    const filename = `google_avatar_${Date.now()}.jpg`;
    const localPath = path.join(tempDir, filename);
    
    // Download the image
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync(localPath, response.data);
    
    return localPath;
  } catch (error) {
    console.error("Error downloading image:", error.message);
    return null;
  }
};

export default downloadImageFromUrl;