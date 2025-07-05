// import cron from 'node-cron';
// import { postToPinterest } from '../controllers/pinterest.controller.js';

// // Pinterest auto-posting cron job
// export const startPinterestCron = () => {
//   // Run every hour (0 * * * *)
//   cron.schedule('0 * * * *', async () => {
//     console.log('Pinterest cron job triggered at:', new Date().toISOString());
//     const result = await postToPinterest();
    
//     if (result.success) {
//       console.log('Pinterest post successful:', result.data);
//     } else {
//       console.log('Pinterest post failed:', result.error || result.message);
//     }
//   });

//   console.log('Pinterest auto-posting cron job started - runs every hour');
// };

// // For testing - run every minute
// export const startPinterestTestCron = () => {
//   cron.schedule('* * * * *', async () => {
//     console.log('Pinterest TEST cron job triggered at:', new Date().toISOString());
//     const result = await postToPinterest();
    
//     if (result.success) {
//       console.log('Pinterest post successful:', result.data);
//     } else {
//       console.log('Pinterest post failed:', result.error || result.message);
//     }
//   });

//   console.log('Pinterest TEST cron job started - runs every minute');
// };