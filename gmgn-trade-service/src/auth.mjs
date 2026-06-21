export function isAuthorized(req, config) {
  if (!config.hookSecret) return true;
  const header = req.headers['x-gmgn-hook-secret'];
  return typeof header === 'string' && header === config.hookSecret;
}
