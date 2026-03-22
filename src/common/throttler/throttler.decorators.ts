import { SetMetadata } from '@nestjs/common';
import { Throttle as NestThrottle } from '@nestjs/throttler';

export const THROTTLER_LIMIT_METADATA = 'throttler:limit';

/**
 * Aplica rate limiting específico para endpoints de autenticación
 * Más restrictivo para prevenir ataques de fuerza bruta
 */
export const ThrottleAuth = () =>
  NestThrottle({
    default: { limit: 10, ttl: 60000 }, // 10 intentos por minuto
  });

/**
 * Aplica rate limiting específico para endpoints de AI
 * Balance entre uso normal y prevención de abuso
 */
export const ThrottleAI = () =>
  NestThrottle({
    default: { limit: 20, ttl: 60000 }, // 20 requests por minuto
  });

/**
 * Aplica rate limiting específico para uploads
 * Prevenir spam de archivos
 */
export const ThrottleUpload = () =>
  NestThrottle({
    default: { limit: 10, ttl: 60000 }, // 10 uploads por minuto
  });

/**
 * Rate limiting más relajado para usuarios premium
 */
export const ThrottlePremium = () =>
  NestThrottle({
    default: { limit: 200, ttl: 60000 }, // 200 requests por minuto
  });

/**
 * Saltar rate limiting (solo para casos especiales)
 */
export const SkipThrottle = () => SetMetadata('throttler:skip', true);
