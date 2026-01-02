import {
  ListObjectsV2Command,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, BUCKET_NAME } from "../config/aws.js";
import logger from "../config/logger.js";
import path from "path";

export const getStorageUsage = async (prefix) => {
  let totalSize = 0;
  let totalFiles = 0; // Added file count
  let fileTypeDistribution = {}; // e.g. { 'images': 100, 'docs': 500 }
  let extensionDistribution = {}; // e.g. { '.png': 50, '.pdf': 20 }

  let isTruncated = true;
  let continuationToken = null;

  try {
    while (isTruncated) {
      const command = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      const response = await s3Client.send(command);
      (response.Contents || []).forEach((obj) => {
        totalSize += obj.Size;

        if (!obj.Key.endsWith("/")) {
          totalFiles++; // Increment file count
          const ext = path.extname(obj.Key).toLowerCase();
          extensionDistribution[ext] =
            (extensionDistribution[ext] || 0) + obj.Size;

          let type = "others";
          if ([".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext))
            type = "images";
          else if ([".pdf", ".doc", ".docx", ".txt"].includes(ext))
            type = "documents";
          else if ([".mp4", ".mov", ".avi"].includes(ext)) type = "video";
          else if ([".mp3", ".wav"].includes(ext)) type = "audio";

          fileTypeDistribution[type] =
            (fileTypeDistribution[type] || 0) + obj.Size;
        }
      });

      isTruncated = response.IsTruncated;
      continuationToken = response.NextContinuationToken;
    }

    return {
      totalSize,
      totalFiles, // Return file count
      fileTypeDistribution: Object.entries(fileTypeDistribution).map(
        ([name, value]) => ({ name, value })
      ),
      extensionDistribution: Object.entries(extensionDistribution).map(
        ([name, value]) => ({ name, value })
      ),
    };
  } catch (error) {
    logger.error(
      `Error calculating storage for prefix ${prefix}: ${error.message}`
    );
    throw error;
  }
};

export const listClientObjects = async (prefix, subPath = "") => {
  const fullPrefix = `${prefix}${subPath}`.replace(/\/+$/, "") + "/";

  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: fullPrefix,
      Delimiter: "/",
    });

    const response = await s3Client.send(command);

    const folders = (response.CommonPrefixes || []).map((p) => ({
      name: p.Prefix.replace(fullPrefix, "").replace("/", ""),
      type: "folder",
      path: p.Prefix,
    }));

    const files = await Promise.all(
      (response.Contents || [])
        .filter((obj) => obj.Key !== fullPrefix)
        .map(async (obj) => {
          let previewUrl = null;
          try {
            const command = new GetObjectCommand({
              Bucket: BUCKET_NAME,
              Key: obj.Key,
            });
            previewUrl = await getSignedUrl(s3Client, command, {
              expiresIn: 3600,
            });
          } catch (e) {}

          return {
            name: obj.Key.replace(fullPrefix, ""),
            type: "file",
            size: obj.Size,
            lastModified: obj.LastModified,
            key: obj.Key,
            previewUrl, // <--- Auto-generated URL
          };
        })
    );

    return [...folders, ...files];
  } catch (error) {
    logger.error(
      `Error listing objects for prefix ${fullPrefix}: ${error.message}`
    );
    throw error;
  }
};

export const deleteS3Object = async (key) => {
  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );
  } catch (error) {
    logger.error(`Error deleting object ${key}: ${error.message}`);
    throw error;
  }
};

export const deleteS3Folder = async (prefix) => {
  try {
    let isTruncated = true;
    let continuationToken = null;

    while (isTruncated) {
      const listCommand = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      const listResponse = await s3Client.send(listCommand);
      const objects = listResponse.Contents || [];

      if (objects.length > 0) {
        await s3Client.send(
          new DeleteObjectsCommand({
            Bucket: BUCKET_NAME,
            Delete: {
              Objects: objects.map((obj) => ({ Key: obj.Key })),
            },
          })
        );
      }

      isTruncated = listResponse.IsTruncated;
      continuationToken = listResponse.NextContinuationToken;
    }
  } catch (error) {
    logger.error(`Error deleting folder ${prefix}: ${error.message}`);
    throw error;
  }
};

export const generatePresignedUrl = async (key) => {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    // URL expires in 15 minutes (900 seconds)
    const url = await getSignedUrl(s3Client, command, { expiresIn: 900 });
    return url;
  } catch (error) {
    logger.error(`Error generating presigned URL for ${key}: ${error.message}`);
    throw error;
  }
};

export const uploadS3Object = async (key, body, contentType) => {
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: contentType,
        // ACL: "public-read", // Optional: depends on bucket settings, but good for public files
      })
    );
    return `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;
  } catch (error) {
    logger.error(`Error uploading object ${key}: ${error.message}`);
    throw error;
  }
};
