import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import prisma from "../config/db.js";
import { AppError } from "../utils/errors.js";

export const login = async (email, password) => {
  if (!email || !password) {
    throw new AppError("Please provide email and password", 400);
  }

  const admin = await prisma.admin.findUnique({
    where: { email },
  });

  if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
    throw new AppError("Incorrect email or password", 401);
  }

  const token = jwt.sign(
    { id: admin.id, email: admin.email },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  return { token, admin: { id: admin.id, email: admin.email } };
};

export const createAdmin = async (email, password) => {
  const hashedPassword = await bcrypt.hash(password, 12);
  return await prisma.admin.create({
    data: {
      email,
      password_hash: hashedPassword,
    },
  });
};
