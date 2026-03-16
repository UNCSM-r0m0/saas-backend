import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * Parsea la variable FRONTEND_URLS (comma-separated) en array de orígenes.
 * Soporta wildcards (*), dominios específicos, y regex para patrones.
 */
function parseFrontendUrls(): (string | RegExp)[] {
  const urlsEnv = process.env.FRONTEND_URLS || process.env.FRONTEND_URL;
  
  if (!urlsEnv) {
    // Defaults para desarrollo
    return [
      'http://localhost:3001',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ];
  }

  const urls = urlsEnv.split(',').map(u => u.trim()).filter(Boolean);
  const origins: (string | RegExp)[] = [];

  for (const url of urls) {
    if (url === '*') {
      origins.push('*');
    } else if (url.includes('*')) {
      // Convertir wildcard a regex
      const pattern = url
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
      origins.push(new RegExp(`^${pattern}$`, 'i'));
    } else {
      origins.push(url);
    }
  }

  return origins;
}

/**
 * Configuración CORS dinámica basada en variables de entorno.
 * 
 * Variables de entorno:
 * - FRONTEND_URL: URL principal del frontend (backward compatibility)
 * - FRONTEND_URLS: Lista separada por comas de URLs permitidas (ej: https://app.com,https://admin.com)
 * - CORS_ALLOW_ALL: Si es "true", permite cualquier origen (NO RECOMENDADO EN PROD)
 */
export const corsOptions: CorsOptions = {
  origin: (() => {
    // Si CORS_ALLOW_ALL=true, permitir todo (solo para desarrollo/debug)
    if (process.env.CORS_ALLOW_ALL === 'true') {
      console.warn('⚠️ CORS: Permitiendo TODOS los orígenes (CORS_ALLOW_ALL=true)');
      return true;
    }

    const origins = parseFrontendUrls();
    
    // Agregar FRONTEND_URL si existe y no está ya en la lista
    if (process.env.FRONTEND_URL && !origins.includes(process.env.FRONTEND_URL)) {
      origins.push(process.env.FRONTEND_URL);
    }

    // Agregar PUBLIC_URL para el mismo origen
    if (process.env.PUBLIC_URL && !origins.includes(process.env.PUBLIC_URL)) {
      origins.push(process.env.PUBLIC_URL);
    }

    // Dominios de desarrollo/tunneling (solo en desarrollo)
    if (process.env.NODE_ENV !== 'production') {
      origins.push(
        /https?:\/\/([a-z0-9-]+\.)*vercel\.app$/i,
        /https?:\/\/([a-z0-9-]+\.)*trycloudflare\.com$/i,
        /https?:\/\/([a-z0-9-]+\.)*ngrok-free\.(dev|app)$/i,
        /https?:\/\/([a-z0-9-]+\.)*ngrok\.app$/i,
      );
    }

    return origins;
  })(),
  credentials: true,
  methods: process.env.CORS_METHODS || 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: process.env.CORS_ALLOWED_HEADERS || 
    'Content-Type, Authorization, Accept, X-Requested-With, Cache-Control, Pragma, Expires, ngrok-skip-browser-warning',
  exposedHeaders: process.env.CORS_EXPOSED_HEADERS || 'X-Total-Count, X-Page-Count',
  maxAge: parseInt(process.env.CORS_MAX_AGE || '86400', 10), // 24 horas
  preflightContinue: false,
  optionsSuccessStatus: 204,
};
