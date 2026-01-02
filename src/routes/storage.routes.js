import express from "express";
import multer from "multer";
import * as storageController from "../controllers/storage.controller.js";
import { protect } from "../middlewares/auth.js";

const router = express.Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage() });

router.use(protect);

router.get("/usage", storageController.getUsage);
router.get("/preview", storageController.getPreviewUrl);
router.get("/", storageController.listStorage);
router.post("/upload", upload.single("file"), storageController.uploadFile);
router.delete("/object", storageController.deleteObject);
router.delete("/folder", storageController.deleteFolder);

export default router;
