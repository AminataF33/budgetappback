export const notFound = (req, res) => {
  res.status(404).json({
    error: `Route ${req.originalUrl} non trouvée`,
    code: "ROUTE_NOT_FOUND",
    method: req.method,
    path: req.originalUrl,
  })
}
