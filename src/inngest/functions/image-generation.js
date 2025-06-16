import { NonRetriableError } from "inngest";
import { inngest } from "../client.js";
import image from "../../models/image.model.js";
import {
  generateImage,
  generateStructuredContent,
} from "../../utils/geminiApiCall.js";
import {
  getNextKeywordBatch,
  updateKeywordStatus, // Use for individual status updates
  markRowCompleted, // Use for final row completion
} from "../../utils/googleSheetsApiCall.js";
import { convertToAvif } from "../../utils/imageConversionToAvif.js";
import uploadToDOSpaces from "../../utils/digitalOceanSpace.js";

// RELIABLE SEQUENTIAL PATTERN
// This function processes all keywords in a single row sequentially,
// ensuring each step is resumable and that the row is marked complete only at the end.
export const BulkAiImageGeneration = inngest.createFunction(
  { id: "bulk-ai-image-generation-sequential", retries: 2 },
  { event: "ai/image-generation.start" },
  async ({ event, step }) => {
    // Step 1: Fetch the entire batch of keywords for one row.
    const keywords = await step.run("fetch-batch-keywords", async () => {
      return await getNextKeywordBatch();
    });
    if (!keywords || keywords.length === 0) {
      return { message: "No new keywords to process. All rows are complete." };
    }

    const rowIndex = keywords[0].rowIndex; // All keywords are from the same row.

    // Step 2: Loop through each keyword and process it with resumable steps.
    for (const keyword of keywords) {
      // Create a unique ID for each step to ensure resumability
      const stepId = `${keyword.keyword.replace(/\s/g, "-")}`;

      try {
        const structuredContent = await step.run(
          `1-gen-content:${stepId}`,
          async () => {
            return await generateStructuredContent(keyword.keyword);
          }
        );

        console.log(
          "after structuredContent step run the data of it is",
          structuredContent
        );

        const generatedImage = await step.run(
          `2-gen-image:${stepId}`,
          async () => {
            return await generateImage(structuredContent.data.prompt, keyword.keyword);
          }
        );

        console.log(
          "after generateImage step run the data of it is",
          generatedImage
        );

        await step.run(`3-save-to-db:${stepId}`, async () => {
          return await image.create({
            ImageFile: generatedImage.data.image,
            Alt: structuredContent.data.alt,
            Caption: structuredContent.data.caption,
            ImgTitle: structuredContent.data.imgTitle,
            UploadedBy: "GeminiAPI",
            Category: keyword.category,
            PageSlug: `${keyword.keyword
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "")}-free-images-${Math.floor(
              10000 + Math.random() * 90000
            )}`,
            PageTitle: `${keyword.keyword} Free Images - Realistic AI Generated Images`,
            PageDescription: structuredContent.data.pageDescription,
            Prompt: structuredContent.data.prompt,
          });
        });

        // Update status for THIS keyword to 'success'
        await step.run(`6-update-sheet-success:${stepId}`, async () => {
          await updateKeywordStatus(
            keyword.columnLetter,
            keyword.rowIndex,
            "success",
            keyword.keyword
          );
        });
      } catch (error) {
        console.error(`❌ Failed to process ${keyword.keyword}:`, error);

        const geminiStatusCodesToStop = [400, 403, 404, 429, 500, 503, 504];
        let shouldStop = false;

        // If your Gemini API errors return a statusCode
        if (
          error &&
          (geminiStatusCodesToStop.includes(error.statusCode) ||
            (error.response &&
              geminiStatusCodesToStop.includes(error.response.status)))
        ) {
          shouldStop = true;
        }

        // Optionally, check error.message for specific error strings
        if (
          error &&
          typeof error.message === "string" &&
          (error.message.includes("RESOURCE_EXHAUSTED") ||
            error.message.includes("PERMISSION_DENIED") ||
            error.message.includes("INTERNAL") ||
            error.message.includes("UNAVAILABLE") ||
            error.message.includes("DEADLINE_EXCEEDED"))
        ) {
          shouldStop = true;
        }

        if (shouldStop) {
          // Stop processing and let Inngest handle the retry/backoff
          throw new NonRetriableError(
            `Critical Gemini API error: ${
              error.message || JSON.stringify(error)
            }`
          );
        }

        // If any step fails, update status for THIS keyword to 'failed'
        await step.run(`6-update-sheet-failure:${stepId}`, async () => {
          await updateKeywordStatus(
            keyword.columnLetter,
            keyword.rowIndex,
            "failed",
            keyword.keyword
          );
        });
        // We do not re-throw, allowing the loop to continue with the next keyword.
      }
    }

    // Step 3: After the loop, mark the entire row as completed.
    await step.run(`7-mark-row-completed:${rowIndex}`, async () => {
      await markRowCompleted(rowIndex);
    });

    // Step 4: Trigger the next batch run automatically.
    await step.sendEvent("trigger-next-batch", {
      name: "ai/image-generation.start",
      data: {},
    });

    return {
      message: `Finished processing row ${rowIndex}. Triggering next batch.`,
    };
  }
);

// Helper function to manually trigger the first run of the process.
export const startBulkGeneration = async () => {
  await inngest.send({
    name: "ai/image-generation.start",
    data: {},
  });
  console.log("🚀 Bulk generation process started.");
};
