import { IncomingForm } from "formidable";
import fs from "fs";
import path from "path";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const tmpDir = path.join("/tmp", "uploads");
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const form = new IncomingForm({
    uploadDir: tmpDir,
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024,
  });

  form.parse(req, (err: any, _fields: any, files: any) => {
    if (err) {
      return res.status(500).json({ error: "Error al procesar archivo" });
    }

    const file = files.file?.[0] || files.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const mime = file.mimetype || "";
    const fileType = mime.startsWith("image")
      ? "image"
      : mime.startsWith("video")
        ? "video"
        : mime === "application/zip" ||
            mime === "application/x-zip-compressed" ||
            mime === "application/x-zip"
          ? "zip"
          : "audio";

    const filename = path.basename(file.filepath || file.newFilename);
    res.json({
      url: `/api/files/${filename}`,
      name: file.originalFilename || filename,
      type: fileType,
    });
  });
}
