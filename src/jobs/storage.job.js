import cron from "node-cron";
import prisma from "../config/db.js";
import * as storageService from "../services/storage.service.js";
import logger from "../config/logger.js";

const updateStorageUsage = async () => {
  logger.info("Starting storage usage update job...");
  try {
    const clients = await prisma.client.findMany({
      where: { status: "active" },
    });

    for (const client of clients) {
      try {
        const usage = await storageService.getStorageUsage(client.s3_prefix);
        await prisma.client.update({
          where: { id: client.id },
          data: { storage_used_bytes: BigInt(usage) },
        });
        logger.info(
          `Updated storage for client: ${client.name} (${usage} bytes)`
        );
      } catch (err) {
        logger.error(
          `Failed to update storage for client ${client.id}: ${err.message}`
        );
      }
    }
    logger.info("Storage usage update job completed.");
  } catch (err) {
    logger.error(`Storage usage job failed: ${err.message}`);
  }
};

// Run every 6 hours
const initJobs = () => {
  cron.schedule("0 */6 * * *", updateStorageUsage);
  logger.info("Background jobs initialized");
};

export default initJobs;
