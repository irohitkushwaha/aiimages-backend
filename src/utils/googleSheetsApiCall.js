import { google } from "googleapis";
import path from "path";

// Configuration
const CONFIG = {
  SHEET_ID: process.env.GOOGLE_SHEET_ID,
  SHEET_NAME: "Sheet1",
  STATUS_SHEET_NAME: "Status",
  CATEGORIES: [
    "Business",
    "Finance",
    "Education & Learning",
    "Technology",
    "Festivals & occasions",
    "Fashion & beauty",
    "Travel, Lifestyle & Nature",
    "Home Design & Real Estate",
    "Food & Drink",
  ],
  START_ROW: 5,
  CATEGORY_ROW: 3,
};

let sheetsClient = null;
let currentRow = CONFIG.START_ROW;

// Initialize Google Sheets client
async function initSheetsClient() {
  try {
    const keyFile = path.join(
      process.cwd(),
      "credentials/sheets-service-account.json"
    );
    const auth = new google.auth.GoogleAuth({
      keyFile,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const authClient = await auth.getClient();
    sheetsClient = google.sheets({ version: "v4", auth: authClient });

    // Initialize status tracking
    await initializeStatusSheet();

    console.log("✅ Google Sheets client initialized");
    return sheetsClient;
  } catch (error) {
    console.error("❌ Failed to initialize Sheets client:", error);
    throw error;
  }
}

// Get sheets client (creates if doesn't exist)
async function getSheetsClient() {
  if (!sheetsClient) {
    await initSheetsClient();
  }
  return sheetsClient;
}

getSheetsClient();

// Create status sheet if it doesn't exist
async function initializeStatusSheet() {
  try {
    const sheets = await getSheetsClient();

    // Check if status sheet exists
    const sheetInfo = await sheets.spreadsheets.get({
      spreadsheetId: CONFIG.SHEET_ID,
    });

    const statusSheetExists = sheetInfo.data.sheets.some(
      (sheet) => sheet.properties.title === CONFIG.STATUS_SHEET_NAME
    );

    if (!statusSheetExists) {
      // Create status sheet with headers
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: CONFIG.SHEET_ID,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: CONFIG.STATUS_SHEET_NAME,
                },
              },
            },
          ],
        },
      });

      // Add headers to status sheet
      await sheets.spreadsheets.values.update({
        spreadsheetId: CONFIG.SHEET_ID,
        range: `${CONFIG.STATUS_SHEET_NAME}!A1:E1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [["Row", "Column", "Keyword", "Status", "Timestamp"]],
        },
      });

      console.log("✅ Status sheet created with headers");
    }
  } catch (error) {
    console.error("⚠️ Status sheet initialization failed:", error);
  }
}

// Check if keyword was already processed (has status markers)
async function isKeywordProcessed(rowIndex, columnLetter) {
  try {
    const sheets = await getSheetsClient();
    const range = `${CONFIG.STATUS_SHEET_NAME}!A:D`;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.SHEET_ID,
      range,
    });

    const rows = response.data.values || [];

    // Check if this specific keyword was already processed
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (
        row[0] == rowIndex &&
        row[1] === columnLetter &&
        (row[3] === "success" || row[3] === "failed")
      ) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("⚠️ Could not check keyword status:", error);
    return false; // Assume not processed if can't check
  }
}

async function getLastProcessedRow() {
  try {
    const sheets = await getSheetsClient();
    const range = `${CONFIG.STATUS_SHEET_NAME}!A:D`;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.SHEET_ID,
      range,
    });

    const rows = response.data.values || [];
    let lastProcessedRow = CONFIG.START_ROW - 1;

    // Skip header row and find highest completed row
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[0] && row[3] === "completed") {
        const rowNum = parseInt(row[0]);
        if (rowNum > lastProcessedRow) {
          lastProcessedRow = rowNum;
        }
      }
    }

    return lastProcessedRow === CONFIG.START_ROW - 1 ? null : lastProcessedRow;
  } catch (error) {
    console.error("⚠️ Could not read status sheet:", error);
    return null;
  }
}

// Find next unprocessed row by scanning the sheet
//check karta hai ki jo hum current row me api call karne wale hain to kya wo aesa to nhi hai ki sab cell of that row is empty? agar empty hai to aage wale row ko do jisme at least kisi category(coumn me 1 keyword ho)
async function findNextUnprocessedRow(startRow = null) {
  try {
    const sheets = await getSheetsClient();
    const searchStart = startRow || currentRow;
    const range = `${CONFIG.SHEET_NAME}!A${searchStart}:I${searchStart + 50}`;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.SHEET_ID,
      range,
    });

    const rows = response.data.values || [];

    // Find first row with at least one non-empty keyword
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row && row.some((cell) => cell && cell.trim() !== "")) {
        return searchStart + i;
      }
    }

    return null; // No more rows found
  } catch (error) {
    console.error("❌ Error finding next unprocessed row:", error);
    return null;
  }
}

// Get next row to process
async function getNextRowToProcess() {
  try {
    // First check status sheet for last processed row
    const lastProcessed = await getLastProcessedRow();
    if (lastProcessed) {
      currentRow = lastProcessed + 1;
    }

    // Then find next row with content
    const nextRow = await findNextUnprocessedRow(currentRow);
    if (nextRow) {
      currentRow = nextRow;
      return currentRow;
    }

    return null; // No more rows to process
  } catch (error) {
    console.error("❌ Error getting next row to process:", error);
    return null;
  }
}

// Fetch keywords from specific row (skip already processed ones)
async function fetchKeywordsFromRow(rowIndex) {
  try {
    const sheets = await getSheetsClient();
    const range = `${CONFIG.SHEET_NAME}!A${rowIndex}:I${rowIndex}`;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.SHEET_ID,
      range,
    });

    const row =
      response.data.values && response.data.values[0]
        ? response.data.values[0]
        : [];

    // Map to structured data and filter empty cells + already processed
    const allKeywords = CONFIG.CATEGORIES.map((category, index) => ({
      category,
      keyword: row[index] ? row[index].trim() : null,
      columnIndex: index,
      columnLetter: String.fromCharCode(65 + index), // A, B, C, etc.
      rowIndex: rowIndex,
    })).filter((item) => item.keyword && item.keyword !== "");

    // Filter out already processed keywords
    const unprocessedKeywords = [];
    for (const item of allKeywords) {
      const alreadyProcessed = await isKeywordProcessed(
        item.rowIndex,
        item.columnLetter
      );
      if (!alreadyProcessed) {
        unprocessedKeywords.push(item);
      }
    }

    console.log(
      `📥 Found ${allKeywords.length} keywords, ${unprocessedKeywords.length} unprocessed from row ${rowIndex}`
    );
    return unprocessedKeywords;
  } catch (error) {
    console.error(`❌ Error fetching keywords from row ${rowIndex}:`, error);
    throw error;
  }
}

// Update cell status with color formatting
export async function updateKeywordStatus(
  columnLetter,
  rowIndex,
  status,
  keyword = ""
) {
  try {
    const sheets = await getSheetsClient();

    // Set color based on status
    const color =
      status === "success"
        ? { red: 0.0, green: 0.8, blue: 0.0 } // Green
        : { red: 0.9, green: 0.0, blue: 0.0 }; // Red

    // Update cell formatting
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: CONFIG.SHEET_ID,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: 0, // Main sheet ID
                startRowIndex: rowIndex - 1,
                endRowIndex: rowIndex,
                startColumnIndex: columnLetter.charCodeAt(0) - 65,
                endColumnIndex: columnLetter.charCodeAt(0) - 65 + 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: color,
                  textFormat: {
                    foregroundColor: { red: 1, green: 1, blue: 1 }, // White text
                  },
                },
              },
              fields:
                "userEnteredFormat(backgroundColor,textFormat.foregroundColor)",
            },
          },
        ],
      },
    });

    // Log to status sheet for tracking
    await logToStatusSheet(rowIndex, columnLetter, keyword, status);

    console.log(`✅ Updated ${columnLetter}${rowIndex} - Status: ${status}`);
  } catch (error) {
    console.error(`❌ Failed to update ${columnLetter}${rowIndex}:`, error);
    throw error;
  }
}

// Log status to status sheet
async function logToStatusSheet(rowIndex, columnLetter, keyword, status) {
  try {
    const sheets = await getSheetsClient();
    const timestamp = new Date().toISOString();
    const values = [[rowIndex, columnLetter, keyword, status, timestamp]];

    await sheets.spreadsheets.values.append({
      spreadsheetId: CONFIG.SHEET_ID,
      range: `${CONFIG.STATUS_SHEET_NAME}!A:E`,
      valueInputOption: "RAW",
      requestBody: { values },
    });
  } catch (error) {
    console.error("⚠️ Failed to log to status sheet:", error);
  }
}

// Mark entire row as completed
export async function markRowCompleted(rowIndex) {
  try {
    await logToStatusSheet(rowIndex, "ALL", "ROW_COMPLETED", "completed");
    console.log(`✅ Row ${rowIndex} marked as completed`);
  } catch (error) {
    console.error(`❌ Failed to mark row ${rowIndex} completed:`, error);
  }
}

// Main function to get next batch of keywords
export async function getNextKeywordBatch() {
  try {
    // Get next row to process
    const nextRow = await getNextRowToProcess();
    if (!nextRow) {
      console.log("🎉 All keywords processed!");
      return null;
    }

    // Fetch keywords from that row
    const keywords = await fetchKeywordsFromRow(nextRow);

    if (keywords.length === 0) {
      // Skip empty row and try next
      currentRow = nextRow + 1;
      return await getNextKeywordBatch();
    }

    return keywords;
  } catch (error) {
    console.error("❌ Error getting next keyword batch:", error);
    throw error;
  }
}

// Initialize everything
export async function initializeGoogleSheets() {
  try {
    await initSheetsClient();
    console.log("✅ Google Sheets handler ready");
  } catch (error) {
    console.error("❌ Failed to initialize Google Sheets:", error);
    throw error;
  }
}

// Get current processing position (for debugging)
export function getCurrentRow() {
  return currentRow;
}

// Reset processing position (if needed)
export function resetCurrentRow(rowIndex = CONFIG.START_ROW) {
  currentRow = rowIndex;
  console.log(`🔄 Current row reset to ${currentRow}`);
}

// Export default getSheetsClient for backward compatibility
export default getSheetsClient;
