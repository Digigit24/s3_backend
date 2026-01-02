import prisma from "../config/db.js";
import * as awsService from "../services/aws.service.js";
import { AppError } from "../utils/errors.js";
import logger from "../config/logger.js";

export const createClient = async (clientData, adminEmail) => {
  const { name, storage_limit_bytes } = clientData;

  // Sanitize name for S3 prefix (lowercase, alphanumeric, hyphens, underscores)
  const sanitized = name.toLowerCase().replace(/[^a-z0-9-_]/g, "_");
  const s3_prefix = `${sanitized}/`; // Simple prefix based on name

  const client = await prisma.client.create({
    data: {
      name,
      storage_limit_bytes: storage_limit_bytes
        ? BigInt(storage_limit_bytes)
        : undefined,
      s3_prefix,
    },
  });

  try {
    // Pass the exact prefix we stored in DB
    const awsData = await awsService.createClientIAM(
      client.id,
      name,
      client.s3_prefix
    );

    const updatedClient = await prisma.client.update({
      where: { id: client.id },
      data: {
        status: "active",
        // s3_prefix is already set
        iam_user_arn: awsData.userArn,
        access_key_id: awsData.accessKeyId,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "Client created",
        client_id: client.id,
        performed_by: adminEmail,
      },
    });

    try {
      const fs = await import("fs");
      const path = await import("path");
      const secretPath = path.resolve(
        process.cwd(),
        "secrets",
        `key_${client.id}.txt`
      );
      fs.writeFileSync(
        secretPath,
        `CLIENT: ${name}\nID: ${client.id}\nACCESS_KEY: ${awsData.accessKeyId}\nSECRET_KEY: ${awsData.secretAccessKey}\n\n(Delete this file after copying!)`
      );
    } catch (e) {
      console.error("Failed to write secret file", e);
    }

    return {
      ...updatedClient,
      storage_used_bytes: updatedClient.storage_used_bytes.toString(),
      storage_limit_bytes: updatedClient.storage_limit_bytes.toString(),
      secret_access_key: awsData.secretAccessKey,
    };
  } catch (error) {
    await prisma.client.delete({ where: { id: client.id } });
    throw error;
  }
};

export const getAllClients = async () => {
  const clients = await prisma.client.findMany({
    orderBy: { created_at: "desc" },
  });

  return clients.map((c) => ({
    ...c,
    storage_used_bytes: c.storage_used_bytes.toString(),
    storage_limit_bytes: c.storage_limit_bytes.toString(),
  }));
};

export const getClientById = async (id) => {
  const client = await prisma.client.findUnique({
    where: { id },
    include: { audit_logs: true },
  });

  if (!client) throw new AppError("Client not found", 404);

  return {
    ...client,
    storage_used_bytes: client.storage_used_bytes.toString(),
    storage_limit_bytes: client.storage_limit_bytes.toString(),
  };
};

export const disableClient = async (id, adminEmail) => {
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) throw new AppError("Client not found", 404);

  await awsService.updateIAMUserStatus(id, false);

  const updatedClient = await prisma.client.update({
    where: { id },
    data: { status: "disabled" },
  });

  await prisma.auditLog.create({
    data: {
      action: "Client disabled",
      client_id: id,
      performed_by: adminEmail,
    },
  });

  return {
    ...updatedClient,
    storage_used_bytes: updatedClient.storage_used_bytes.toString(),
    storage_limit_bytes: updatedClient.storage_limit_bytes.toString(),
  };
};

export const deleteClient = async (id, adminEmail) => {
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) throw new AppError("Client not found", 404);

  await awsService.deleteClientIAM(id);

  await prisma.auditLog.deleteMany({ where: { client_id: id } });
  await prisma.client.delete({ where: { id } });
  logger.info(`Client ${id} deleted by ${adminEmail}`);
};

export const rotateClientKey = async (id, adminEmail) => {
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) throw new AppError("Client not found", 404);

  const newKeys = await awsService.rotateClientKey(id);

  const updatedClient = await prisma.client.update({
    where: { id },
    data: { access_key_id: newKeys.accessKeyId },
  });

  await prisma.auditLog.create({
    data: {
      action: "Keys rotated",
      client_id: id,
      performed_by: adminEmail,
    },
  });

  try {
    const fs = await import("fs");
    const path = await import("path");
    const secretPath = path.resolve(
      process.cwd(),
      "secrets",
      `rotated_key_${id}.txt`
    );
    fs.writeFileSync(
      secretPath,
      `CLIENT ID: ${id}\nNEW ACCESS_KEY: ${newKeys.accessKeyId}\nNEW SECRET_KEY: ${newKeys.secretAccessKey}\n\n(Delete this file after copying!)`
    );
  } catch (e) {
    console.error("Failed to write secret file", e);
  }

  return {
    ...updatedClient,
    storage_used_bytes: updatedClient.storage_used_bytes.toString(),
    storage_limit_bytes: updatedClient.storage_limit_bytes.toString(),
    secret_access_key: newKeys.secretAccessKey,
  };
};

export const updateClientStorageLimit = async (id, newLimitBytes) => {
  const updatedClient = await prisma.client.update({
    where: { id },
    data: { storage_limit_bytes: BigInt(newLimitBytes) },
  });

  return {
    ...updatedClient,
    storage_used_bytes: updatedClient.storage_used_bytes.toString(),
    storage_limit_bytes: updatedClient.storage_limit_bytes.toString(),
  };
};
