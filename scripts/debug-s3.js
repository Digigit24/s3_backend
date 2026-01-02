import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load .env from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

async function testFolderCreation() {
  console.log("--- Starting S3 Folder Creation Test ---");
  console.log(`Bucket: ${BUCKET_NAME}`);
  console.log(`Region: ${process.env.AWS_REGION}`);
  console.log(
    `Access Key: ${process.env.AWS_ACCESS_KEY_ID ? "Loaded" : "Missing"}`
  );

  const testPrefix = "test_manual_debug/";

  try {
    console.log(
      `\n1. Attempting to create object with Key: "${testPrefix}"...`
    );

    // Attempt 1: Empty String Body
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: testPrefix,
        Body: "",
      })
    );
    console.log("   > Success! PutObject returned without error.");

    console.log(`\n2. Verifying object existence...`);
    const listCmd = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: testPrefix,
    });

    const listRes = await s3Client.send(listCmd);
    const found = listRes.Contents?.find((o) => o.Key === testPrefix);

    if (found) {
      console.log("   > Verified! Object found in bucket listing.");
      console.log(`   > Key: ${found.Key}, Size: ${found.Size}`);
    } else {
      console.error("   > FAILURE: Object NOT found in bucket listing!");
    }
  } catch (error) {
    console.error("\n!!! ERROR !!!");
    console.error(error);
  }
}

testFolderCreation();
