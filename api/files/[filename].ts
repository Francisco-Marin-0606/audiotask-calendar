import fs from "fs";
import path from "path";

export default function handler(req: any, res: any) {
  const { filename } = req.query;
  const filePath = path.join("/tmp", "uploads", filename as string);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  const file = fs.readFileSync(filePath);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(file);
}
