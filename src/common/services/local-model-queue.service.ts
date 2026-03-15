import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface QueueItem {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    created: number;
}

/**
 * Servicio de cola para limitar la concurrencia en modelos locales
 * Evita saturar recursos de hardware cuando múltiples usuarios hacen peticiones
 */
@Injectable()
export class LocalModelQueueService {
    private readonly logger = new Logger(LocalModelQueueService.name);

    private activeRequests = 0;
    private queue: QueueItem[] = [];
    private readonly maxConcurrent: number;
    private readonly queueTimeout: number;

    constructor(private readonly configService: ConfigService) {
        this.maxConcurrent = this.configService.get<number>('LLM_STUDIO_MAX_CONCURRENT', 2);
        this.queueTimeout = this.configService.get<number>('LLM_STUDIO_QUEUE_TIMEOUT', 30000);

        this.logger.log(`🎯 LocalModelQueue inicializado: max concurrent = ${this.maxConcurrent}, timeout = ${this.queueTimeout}ms`);
    }

    /**
     * Ejecuta una función con control de concurrencia
     */
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        // Si hay capacidad disponible, ejecutar inmediatamente
        if (this.activeRequests < this.maxConcurrent) {
            this.activeRequests++;
            this.logger.log(`▶️ Ejecutando inmediatamente (${this.activeRequests}/${this.maxConcurrent} activos)`);

            try {
                return await fn();
            } finally {
                this.activeRequests--;
                this.processQueue();
            }
        }

        // Si no, encolar la petición
        this.logger.log(`⏳ Encolando petición (${this.queue.length} en cola, ${this.activeRequests}/${this.maxConcurrent} activos)`);

        return new Promise<T>((resolve, reject) => {
            const item: QueueItem = {
                resolve: async () => {
                    this.activeRequests++;
                    this.logger.log(`▶️ Procesando desde cola (${this.activeRequests}/${this.maxConcurrent} activos)`);

                    try {
                        const result = await fn();
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    } finally {
                        this.activeRequests--;
                        this.processQueue();
                    }
                },
                reject,
                created: Date.now(),
            };

            this.queue.push(item);

            // Timeout para evitar esperas infinitas
            setTimeout(() => {
                const index = this.queue.indexOf(item);
                if (index >= 0) {
                    this.queue.splice(index, 1);
                    this.logger.warn(`⏰ Timeout de cola alcanzado para petición`);
                    reject(new Error('Queue timeout: servidor ocupado, intenta más tarde'));
                }
            }, this.queueTimeout);
        });
    }

    /**
     * Procesa el siguiente ítem de la cola
     */
    private processQueue() {
        if (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
            const item = this.queue.shift();
            if (item) {
                this.logger.log(`📤 Sacando de cola (${this.queue.length} restantes)`);
                item.resolve(null);
            }
        }
    }

    /**
     * Obtiene estadísticas de la cola
     */
    getStats() {
        return {
            activeRequests: this.activeRequests,
            queuedRequests: this.queue.length,
            maxConcurrent: this.maxConcurrent,
            utilization: Math.round((this.activeRequests / this.maxConcurrent) * 100),
        };
    }
}

