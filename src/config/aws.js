import { S3Client } from "@aws-sdk/client-s3";
import { IAMClient } from "@aws-sdk/client-iam";
import dotenv from "dotenv";

dotenv.config();

const config = {
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
};

export const s3Client = new S3Client(config);
export const iamClient = new IAMClient(config);
export const BUCKET_NAME = process.env.S3_BUCKET_NAME;
export const ACCOUNT_ID = process.env.AWS_ACCOUNT_ID;
