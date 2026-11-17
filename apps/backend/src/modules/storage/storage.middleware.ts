import multer from "multer";
export const multipartUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 20, fieldSize: 128 * 1024 },
}).single("file");
