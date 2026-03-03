require('dotenv').config();

const allowedOrigins = [
  'https://usenti.com',
  'https://www.usenti.com',
  process.env.FRONTEND_URL
].filter(Boolean); // Remove any undefined values

const isOriginAllowed = (origin) => {
  if (!origin) return true; // Allow requests with no origin (like mobile apps or curl requests)
  return allowedOrigins.some(allowed => origin.startsWith(allowed));
};

const getFrontendUrlFromRequest = (req) => {
  const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
  if (origin && isOriginAllowed(origin)) {
    return origin;
  }
  return process.env.FRONTEND_URL || 'https://nikolaj-storm.github.io/Usenti.2.0';
};

module.exports = {
  allowedOrigins,
  isOriginAllowed,
  getFrontendUrlFromRequest
};
