// import axios from 'axios';
// import Image from '../models/image.model.js';
// // Updated categories matching your MongoDB
// const categories = [
//   'Business',
//   'Finance',
//   'Education & Learning',
//   'Technology',
//   'Festivals & occasions',
//   'Fashion & beauty',
//   'Travel, Lifestyle & Nature',
//   'Home Design & Real Estate',
//   'Food & Drink'
// ];

// // Pinterest Board IDs mapping (you need to get these from Pinterest)
// const boardMapping = {
//   'Business': "1056797937500588349",
//   'Finance': "1056797937500600132",
//   'Education & Learning': "1056797937500600138",
//   'Technology': "1056797937500600139",
//   'Festivals & occasions': "1056797937500600140",
//   'Fashion & beauty': "1056797937500600141",
//   'Travel, Lifestyle & Nature': "1056797937500600142",
//   'Home Design & Real Estate': "1056797937500600143",
//   'Food & Drink': "1056797937500600145"
// };

// // Pinterest API Configuration
// const PINTEREST_ACCESS_TOKEN = process.env.PINTEREST_ACCESS_TOKEN;
// const PINTEREST_API_BASE = 'https://api.pinterest.com/v5';

// // Create pin on Pinterest
// async function createPin(imageData) {
//   try {
//     const boardId = boardMapping[imageData.Category];
//     if (!boardId) {
//       throw new Error(`No board mapped for category: ${imageData.Category}`);
//     }

//     const pinData = {
//       link: `${process.env.WEBSITE_URL}/${imageData.PageSlug}`,
//       title: imageData.ImgTitle || imageData.PageTitle || 'Check this out!',
//       description: imageData.Caption || imageData.PageDescription || '',
//       board_id: boardId,
//       media_source: {
//         source_type: 'image_url',
//         url: imageData.ImageFile
//       }
//     };

//     const response = await axios.post(
//       `${PINTEREST_API_BASE}/pins`,
//       pinData,
//       {
//         headers: {
//           'Authorization': `Bearer ${PINTEREST_ACCESS_TOKEN}`,
//           'Content-Type': 'application/json'
//         }
//       }
//     );

//     return response.data;
//   } catch (error) {
//     console.error('Pinterest API Error:', error.response?.data || error.message);
//     throw error;
//   }
// }

// // Get next category to pin
// async function getNextCategory() {
//   try {
//     const lastPinned = await Image.findOne({
//       isPinnedToPinterest: true
//     }).sort({ pinnedAt: -1 });

//     if (!lastPinned) {
//       return categories[0]; // Start with first category
//     }

//     const lastIndex = categories.indexOf(lastPinned.Category);
//     const nextIndex = (lastIndex + 1) % categories.length;
//     return categories[nextIndex];
//   } catch (error) {
//     console.error('Error getting next category:', error);
//     return categories[0];
//   }
// }

// // Main Pinterest posting function
// export const postToPinterest = async () => {
//   try {
//     console.log('Starting Pinterest post process...');
    
//     const nextCategory = await getNextCategory();
//     console.log(`Next category to post: ${nextCategory}`);

//     // Find unpinned image from the next category
//     const imageToPin = await Image.findOne({
//       Category: nextCategory,
//       isPinnedToPinterest: false,
//       ImageFile: { $exists: true, $ne: '' }
//     }).sort({ createdAt: 1 }); // Oldest first

//     if (!imageToPin) {
//       console.log(`No unpinned images found for category: ${nextCategory}`);
//       return { success: false, message: `No unpinned images found for category: ${nextCategory}` };
//     }

//     console.log(`Found image to pin: ${imageToPin.ImgTitle || imageToPin._id}`);

//     // Create pin on Pinterest
//     const pinResult = await createPin(imageToPin);
//     console.log('Pin created successfully:', pinResult.id);

//     // Update image record
//     await Image.findByIdAndUpdate(imageToPin._id, {
//       isPinnedToPinterest: true,
//       pinnedAt: new Date()
//     });

//     console.log('Image record updated successfully');
//     return { 
//       success: true, 
//       message: 'Pinterest post successful', 
//       data: { 
//         pinId: pinResult.id, 
//         category: nextCategory, 
//         imageTitle: imageToPin.ImgTitle 
//       } 
//     };

//   } catch (error) {
//     console.error('Error in postToPinterest:', error);
//     return { success: false, error: error.message };
//   }
// };

// // Manual trigger endpoint controller
// export const triggerPinterestPost = async (req, res) => {
//   try {
//     const result = await postToPinterest();
    
//     if (result.success) {
//       res.json(result);
//     } else {
//       res.status(400).json(result);
//     }
//   } catch (error) {
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// // Get posting status
// // export const getPinterestStatus = async (req, res) => {
// //   try {
// //     const totalImages = await Image.countDocuments();
// //     const pinnedImages = await Image.countDocuments({ isPinnedToPinterest: true });
// //     const unpinnedImages = totalImages - pinnedImages;
    
// //     const lastPinned = await Image.findOne({
// //       isPinnedToPinterest: true
// //     }).sort({ pinnedAt: -1 });

// //     const categoryStats = await Image.aggregate([
// //       {
// //         $group: {
// //           _id: '$Category',
// //           total: { $sum: 1 },
// //           pinned: { $sum: { $cond: ['$isPinnedToPinterest', 1, 0] } }
// //         }
// //       }
// //     ]);

// //     res.json({
// //       totalImages,
// //       pinnedImages,
// //       unpinnedImages,
// //       nextCategory: await getNextCategory(),
// //       lastPinned: lastPinned ? {
// //         category: lastPinned.Category,
// //         pinnedAt: lastPinned.pinnedAt,
// //         title: lastPinned.ImgTitle
// //       } : null,
// //       categoryStats
// //     });
// //   } catch (error) {
// //     res.status(500).json({ error: error.message });
// //   }
// // };

// // // Reset Pinterest status for testing
// // export const resetPinterestStatus = async (req, res) => {
// //   try {
// //     await Image.updateMany({}, {
// //       isPinnedToPinterest: false,
// //       $unset: { pinnedAt: 1 }
// //     });
// //     res.json({ success: true, message: 'Pinterest status reset for all images' });
// //   } catch (error) {
// //     res.status(500).json({ error: error.message });
// //   }
// // };