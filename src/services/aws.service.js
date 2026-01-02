import {
  CreateUserCommand,
  PutUserPolicyCommand,
  CreateAccessKeyCommand,
  DeleteUserCommand,
  DeleteUserPolicyCommand,
  DeleteAccessKeyCommand,
  ListAccessKeysCommand,
  UpdateAccessKeyCommand,
} from "@aws-sdk/client-iam";
import { PutObjectCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { iamClient, s3Client, BUCKET_NAME, ACCOUNT_ID } from "../config/aws.js";
import logger from "../config/logger.js";

const ensureBucketCors = async () => {
  try {
    const corsCommand = new PutBucketCorsCommand({
      Bucket: BUCKET_NAME,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ["*"],
            AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
            AllowedOrigins: ["*"], // Allow all origins as requested
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3000,
          },
        ],
      },
    });
    await s3Client.send(corsCommand);
  } catch (err) {
    logger.warn(`Failed to set CORS on bucket ${BUCKET_NAME}: ${err.message}`);
    // Don't throw, just warn, as client creation shouldn't fail due to CORS config if it's already there (though this overwrites).
  }
};

export const createClientIAM = async (clientId, clientName, customPrefix) => {
  const userName = `client_${clientId}`;
  const policyName = `S3AccessPolicy_${clientId}`;
  // Use the prefix passed from the service (which is based on the client name)
  const prefix = customPrefix;

  try {
    await iamClient.send(new CreateUserCommand({ UserName: userName }));
    logger.info(`IAM User created: ${userName}`);

    const policyDocument = {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: ["s3:ListBucket"],
          Resource: [`arn:aws:s3:::${BUCKET_NAME}`],
          Condition: {
            StringLike: { "s3:prefix": [`${prefix}*`] },
          },
        },
        {
          Effect: "Allow",
          Action: [
            "s3:GetObject",
            "s3:PutObject",
            "s3:DeleteObject",
            "s3:PutObjectAcl",
          ],
          Resource: [`arn:aws:s3:::${BUCKET_NAME}/${prefix}*`],
        },
      ],
    };

    await iamClient.send(
      new PutUserPolicyCommand({
        UserName: userName,
        PolicyName: policyName,
        PolicyDocument: JSON.stringify(policyDocument),
      })
    );
    logger.info(`Scoped policy attached to: ${userName}`);

    const accessKeyData = await iamClient.send(
      new CreateAccessKeyCommand({ UserName: userName })
    );

    // Create standard folder (object with trailing slash)
    logger.info(
      `Attempting to create S3 folder. Bucket: ${BUCKET_NAME}, Key: ${prefix}`
    );

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: prefix, // Ends with '/' so it creates a folder in Console
        Body: Buffer.from(""),
      })
    );
    // Ensure CORS is set for the bucket
    await ensureBucketCors();

    logger.info(`S3 prefix initialized successfully: ${prefix}`);

    return {
      userName,
      userArn: `arn:aws:iam::${ACCOUNT_ID}:user/${userName}`,
      accessKeyId: accessKeyData.AccessKey.AccessKeyId,
      secretAccessKey: accessKeyData.AccessKey.SecretAccessKey,
    };
  } catch (error) {
    logger.error(
      `IAM provisioning failed for client ${clientId}: ${error.message}`
    );
    try {
      await deleteClientIAM(clientId);
    } catch (cleanupError) {
      logger.error(
        `Cleanup failed for client ${clientId}: ${cleanupError.message}`
      );
    }
    throw error;
  }
};

export const deleteClientIAM = async (clientId) => {
  const userName = `client_${clientId}`;
  const policyName = `S3AccessPolicy_${clientId}`;

  try {
    const keys = await iamClient.send(
      new ListAccessKeysCommand({ UserName: userName })
    );
    for (const key of keys.AccessKeyMetadata || []) {
      await iamClient.send(
        new DeleteAccessKeyCommand({
          UserName: userName,
          AccessKeyId: key.AccessKeyId,
        })
      );
    }

    try {
      await iamClient.send(
        new DeleteUserPolicyCommand({
          UserName: userName,
          PolicyName: policyName,
        })
      );
    } catch (e) {
      // Ignore if policy doesn't exist
    }

    await iamClient.send(new DeleteUserCommand({ UserName: userName }));
    logger.info(`IAM User deleted: ${userName}`);
  } catch (error) {
    if (error.Code === "NoSuchEntity") {
      logger.warn(`IAM User ${userName} already deleted or not found.`);
      return; // Safe to ignore
    }
    logger.error(`Failed to delete IAM user ${userName}: ${error.message}`);
    // DO NOT THROW. Log error but allow DB deletion to proceed.
  }
};

export const rotateClientKey = async (clientId) => {
  const userName = `client_${clientId}`;

  try {
    const listCommand = new ListAccessKeysCommand({ UserName: userName });
    const { AccessKeyMetadata } = await iamClient.send(listCommand);

    if (AccessKeyMetadata && AccessKeyMetadata.length > 0) {
      for (const key of AccessKeyMetadata) {
        await iamClient.send(
          new DeleteAccessKeyCommand({
            UserName: userName,
            AccessKeyId: key.AccessKeyId,
          })
        );
      }
    }

    const createCommand = new CreateAccessKeyCommand({ UserName: userName });
    const { AccessKey } = await iamClient.send(createCommand);

    logger.info(`Rotated keys for user: ${userName}`);

    return {
      accessKeyId: AccessKey.AccessKeyId,
      secretAccessKey: AccessKey.SecretAccessKey,
    };
  } catch (error) {
    logger.error(`Failed to rotate keys for ${userName}: ${error.message}`);
    throw error;
  }
};

export const updateIAMUserStatus = async (clientId, active) => {
  const userName = `client_${clientId}`;
  const keys = await iamClient.send(
    new ListAccessKeysCommand({ UserName: userName })
  );
  for (const key of keys.AccessKeyMetadata || []) {
    await iamClient.send(
      new UpdateAccessKeyCommand({
        UserName: userName,
        AccessKeyId: key.AccessKeyId,
        Status: active ? "Active" : "Inactive",
      })
    );
  }
};
