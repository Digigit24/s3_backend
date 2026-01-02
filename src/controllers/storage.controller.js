import * as storageService from "../services/storage.service.js";
import * as clientService from "../services/client.service.js";
import prisma from "../config/db.js";

export const getUsage = async (req, res, next) => {
  try {
    const client = await clientService.getClientById(req.params.id);
    const stats = await storageService.getStorageUsage(client.s3_prefix);
    res.status(200).json({ status: "success", data: stats });
  } catch (error) {
    next(error);
  }
};

export const listStorage = async (req, res, next) => {
  try {
    const client = await clientService.getClientById(req.params.id);
    const path = req.query.path || "";
    const items = await storageService.listClientObjects(
      client.s3_prefix,
      path
    );
    res.status(200).json({ status: "success", data: { items } });
  } catch (error) {
    next(error);
  }
};

export const deleteObject = async (req, res, next) => {
  try {
    const { key } = req.body;
    const client = await clientService.getClientById(req.params.id);

    // Safety check: ensure key starts with client prefix
    if (!key.startsWith(client.s3_prefix)) {
      return res
        .status(403)
        .json({ status: "fail", message: "Unauthorized object access" });
    }

    await storageService.deleteS3Object(key);

    await prisma.auditLog.create({
      data: {
        action: "S3 object deleted",
        client_id: client.id,
        performed_by: req.admin.email,
      },
    });

    res.status(200).json({ status: "success", message: "Object deleted" });
  } catch (error) {
    next(error);
  }
};

export const deleteFolder = async (req, res, next) => {
  try {
    const { prefix } = req.body;
    const client = await clientService.getClientById(req.params.id);

    // Safety check
    if (!prefix.startsWith(client.s3_prefix)) {
      return res
        .status(403)
        .json({ status: "fail", message: "Unauthorized folder access" });
    }

    await storageService.deleteS3Folder(prefix);

    await prisma.auditLog.create({
      data: {
        action: "S3 folder deleted",
        client_id: client.id,
        performed_by: req.admin.email,
      },
    });

    res.status(200).json({ status: "success", message: "Folder deleted" });
  } catch (error) {
    next(error);
  }
};

export const getPreviewUrl = async (req, res, next) => {
  try {
    const { key } = req.query;
    const client = await clientService.getClientById(req.params.id);

    if (!key || !key.startsWith(client.s3_prefix)) {
      return res
        .status(403)
        .json({ status: "fail", message: "Unauthorized access to file" });
    }

    const url = await storageService.generatePresignedUrl(key);
    res.status(200).json({ status: "success", data: { url } });
  } catch (error) {
    next(error);
  }
};

export const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ status: "fail", message: "No file provided" });
    }

    const { client_id } = req.params; // or however we get it. Ah, route is /:id/storage/upload
    // clientService.getClientById(req.params.id) is correct.
    const client = await clientService.getClientById(req.params.id);

    const key = `${client.s3_prefix}${req.file.originalname}`;

    const url = await storageService.uploadS3Object(
      key,
      req.file.buffer,
      req.file.mimetype
    );

    await prisma.auditLog.create({
      data: {
        action: "File uploaded via API",
        client_id: client.id,
        performed_by: req.admin.email,
      },
    });

    res.status(201).json({ status: "success", data: { url, key } });
  } catch (error) {
    next(error);
  }
};
