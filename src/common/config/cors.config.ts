import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export const corsOptions: CorsOptions = {
  origin: [
    /https?:\/\/([a-z0-9-]+\.)*vercel\.app$/i,
    /https?:\/\/([a-z0-9-]+\.)*ts\.net$/i,
    /https?:\/\/([a-z0-9-]+\.)*trycloudflare\.com$/i,
    /https?:\/\/([a-z0-9-]+\.)*ngrok-free\.(dev|app)$/i,
    /https?:\/\/([a-z0-9-]+\.)*r0lm0\.dev$/i,
    'http://localhost:3001',
    'http://localhost:5173',
    'https://app.r0lm0.dev',
    'https://r3chat.r0lm0.dev',
    'https://api.r0lm0.dev',
    'https://jeanett-uncolorable-pickily.ngrok-free.dev',
    'http://jeanett-uncolorable-pickily.ngrok-free.dev', // HTTP también para ngrok
  ],
  credentials: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  // Permitir cabeceras comunes de control de caché y otras usadas por el cliente
  allowedHeaders:
    'Content-Type, Authorization, Accept, ngrok-skip-browser-warning, X-Requested-With, Cache-Control, Pragma, Expires',
};
