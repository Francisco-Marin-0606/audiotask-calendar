export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(_req: any, res: any) {
  res.status(410).json({
    error:
      "Las subidas se realizan directamente a Firebase Storage desde el cliente. Este endpoint ya no es necesario.",
  });
}
