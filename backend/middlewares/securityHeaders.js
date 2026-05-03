/**
 * Middleware de sécurité pour configurer les en-têtes de réponse
 * Inclut Content-Security-Policy, X-Frame-Options, etc.
 */

export const securityHeaders = (req, res, next) => {
  // Content-Security-Policy - Permet les ressources nécessaires
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com",
      "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com",
      "img-src 'self' data: https:",
      "font-src 'self' https://fonts.gstatic.com data:",
      "connect-src 'self' https: ws: wss:",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  );

  // Empêcher le click-jacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Empêcher le MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Protection XSS (navigateurs modernes)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy (anciennement Feature-Policy)
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=()'
  );

  // HSTS (optionnel - activer en production HTTPS)
  // res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  next();
};
