export function isAuthorized(req, config) {
  if (!config.hookSecret) return config.mode === 'dry-run';
  const header = req.headers['x-gmgn-hook-secret'];
  return typeof header === 'string' && header === config.hookSecret;
}
