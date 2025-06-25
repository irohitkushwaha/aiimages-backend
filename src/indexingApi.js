// indexPages.js
import mongoose from 'mongoose';
import Image from './models/image.model.js';
import { google } from 'googleapis';
import serviceAccount from './service-account-key.json' assert { type: 'json' };
import path from 'path';


// 1. Connect to MongoDB
await mongoose.connect('mongodb://%40aigeneratedimagessUSer:%40AIgEnERat2415632Ed%23Ima356426gess%40%40@127.0.0.1:27017/aigeneratedimagess?authSource=aigeneratedimagess');

// 2. Google Indexing API Setup
const SCOPES = ['https://www.googleapis.com/auth/indexing'];
const GOOGLE_APPLICATION_CREDENTIALS = serviceAccount; // Update this path


const auth = new google.auth.GoogleAuth({
    credentials: GOOGLE_APPLICATION_CREDENTIALS,
    scopes: SCOPES,
});

const indexing = google.indexing({ version: 'v3', auth });

// 3. Fetch 200 URLs where indexStatus does NOT exist (unprocessed)
const images = await Image.find({ 
  PageSlug: { $exists: true, $ne: null, $ne: '' },
  indexStatus: { $exists: false } 
})
.limit(200)
.exec();

console.log(`Found ${images.length} pages to index`);


const categoryMap = [
    { fullCategory: "Business", shortCategory: "business" },
    { fullCategory: "Finance", shortCategory: "finance" },
    { fullCategory: "Education & Learning", shortCategory: "education" },
    { fullCategory: "Technology", shortCategory: "technology" },
    { fullCategory: "Festivals & occasions", shortCategory: "festivals" },
    { fullCategory: "Fashion & beauty", shortCategory: "fashion" },
    { fullCategory: "Travel, Lifestyle & Nature", shortCategory: "nature" },
    {
      fullCategory: "Home Design & Real Estate",
      shortCategory: "real-estate",
    },
    { fullCategory: "Food & Drink", shortCategory: "food" },
  ];


  function getShortCategory(fullCategory) {
    const found = categoryMap.find((c) => c.fullCategory === fullCategory);
    return found ? found.shortCategory : null;
  }

// 4. Process each URL
for (const img of images) {

    const shortCategory = getShortCategory(img.Category);

    if (!shortCategory) {
        console.error(`❌ Unknown category for image ${img._id}, skipping...`);
        continue;
      }


  const url = `https://aigeneratedimagess.com/${shortCategory}/${img.PageSlug}`; // Update your domain
  
  try {
    await indexing.urlNotifications.publish({
      requestBody: {
        url,
        type: 'URL_UPDATED',
      },
    });
    
    // Mark as success
    img.indexStatus = 'success';
    await img.save();
    
    console.log(`✅ Indexed: ${url}`);
    
  } catch (err) {
    const statusCode = err.response?.status || err.code;
    
    // Check for critical errors that should stop the process
    if (statusCode === 429) {
      console.error(`🛑 QUOTA EXCEEDED: Daily limit reached. Stopping process.`);
      console.error(`Error: ${err.message}`);
      break;
    }
    
    if (statusCode === 403) {
      console.error(`🛑 PERMISSION DENIED: Check your service account permissions. Stopping process.`);
      console.error(`Error: ${err.message}`);
      break;
    }
    
    if (statusCode >= 500) {
      console.error(`🛑 SERVER ERROR (${statusCode}): Google server issues. Stopping process.`);
      console.error(`Error: ${err.message}`);
      break;
    }
    
    // For other errors, mark as failed and continue
    img.indexStatus = 'failed';
    await img.save();
    
    console.error(`❌ Failed to index: ${url} - ${err.message}`);
  }
  
  // Small delay to avoid rate limiting
  await new Promise(resolve => setTimeout(resolve, 100));
}

console.log('🎉 Indexing complete.');
process.exit();