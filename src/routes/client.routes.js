import express from "express";
import * as clientController from "../controllers/client.controller.js";
import { protect } from "../middlewares/auth.js";

const router = express.Router();

router.use(protect);

router
  .route("/")
  .get(clientController.getAllClients)
  .post(clientController.createClient);

router
  .route("/:id")
  .get(clientController.getClient)
  .delete(clientController.deleteClient);

router.patch("/:id/disable", clientController.disableClient);
router.post("/:id/rotate-key", clientController.rotateKey);
router.patch("/:id/limit", clientController.updateStorageLimit);

export default router;
