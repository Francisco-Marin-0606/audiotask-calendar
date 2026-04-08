export default function handler(_req: any, res: any) {
  res.status(410).json({
    error:
      "Los archivos se sirven directamente desde Firebase Storage. Este endpoint ya no es necesario.",
  });
}
