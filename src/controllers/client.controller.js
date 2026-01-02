import * as clientService from "../services/client.service.js";

export const getAllClients = async (req, res, next) => {
  try {
    const clients = await clientService.getAllClients();
    res.status(200).json({ status: "success", data: { clients } });
  } catch (error) {
    next(error);
  }
};

export const createClient = async (req, res, next) => {
  try {
    const client = await clientService.createClient(req.body, req.admin.email);
    const config = {
      region: process.env.AWS_REGION,
      bucket: process.env.S3_BUCKET_NAME,
    };
    res.status(201).json({ status: "success", data: { client, config } });
  } catch (error) {
    next(error);
  }
};

export const getClient = async (req, res, next) => {
  try {
    const client = await clientService.getClientById(req.params.id);
    const config = {
      region: process.env.AWS_REGION,
      bucket: process.env.S3_BUCKET_NAME,
    };
    res.status(200).json({ status: "success", data: { client, config } });
  } catch (error) {
    next(error);
  }
};

export const disableClient = async (req, res, next) => {
  try {
    const client = await clientService.disableClient(
      req.params.id,
      req.admin.email
    );
    res.status(200).json({ status: "success", data: { client } });
  } catch (error) {
    next(error);
  }
};

export const deleteClient = async (req, res, next) => {
  try {
    await clientService.deleteClient(req.params.id, req.admin.email);
    res.status(204).json({ status: "success", data: null });
  } catch (error) {
    next(error);
  }
};

export const rotateKey = async (req, res, next) => {
  try {
    const client = await clientService.rotateClientKey(
      req.params.id,
      req.admin.email
    );
    res.status(200).json({ status: "success", data: { client } });
  } catch (error) {
    next(error);
  }
};

export const updateStorageLimit = async (req, res, next) => {
  try {
    const { storage_limit_bytes } = req.body;
    const client = await clientService.updateClientStorageLimit(
      req.params.id,
      storage_limit_bytes
    );
    res.status(200).json({ status: "success", data: { client } });
  } catch (error) {
    next(error);
  }
};
