import jwt from "jsonwebtoken";
import { AppError } from "../utils/errors.js";
import prisma from "../config/db.js";

export const protect = async (req, res, next) => {
  try {
    let token;
    if (req.cookies.token) {
      token = req.cookies.token;
    } else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return next(
        new AppError("You are not logged in. Please log in to get access.", 401)
      );
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const currentAdmin = await prisma.admin.findUnique({
      where: { id: decoded.id },
    });

    if (!currentAdmin) {
      return next(
        new AppError("The admin belonging to this token no longer exists.", 401)
      );
    }

    req.admin = currentAdmin;
    next();
  } catch (error) {
    next(new AppError("Invalid token. Please log in again.", 401));
  }
};
