import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let status: number;
        let message: string;
        let errorCode: string;

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
                message = (exceptionResponse as any).message || exception.message;
                errorCode = (exceptionResponse as any).errorCode || 'HTTP_EXCEPTION';
            } else {
                message = exceptionResponse as string;
                errorCode = 'HTTP_EXCEPTION';
            }
        } else {
            // Manejar errores específicos de APIs externas
            const errorMessage = (exception as any).message || 'Internal server error';

            if (errorMessage.includes('quota') || errorMessage.includes('429')) {
                status = HttpStatus.SERVICE_UNAVAILABLE;
                message = 'El modelo de IA está temporalmente no disponible debido a límites de cuota. Por favor, intenta con otro modelo.';
                errorCode = 'AI_QUOTA_EXCEEDED';
            } else if (errorMessage.includes('API key') || errorMessage.includes('401')) {
                status = HttpStatus.SERVICE_UNAVAILABLE;
                message = 'El modelo de IA no está configurado correctamente. Por favor, contacta al administrador.';
                errorCode = 'AI_CONFIG_ERROR';
            } else if (errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED')) {
                status = HttpStatus.SERVICE_UNAVAILABLE;
                message = 'El modelo de IA no está disponible. Por favor, intenta con otro modelo.';
                errorCode = 'AI_SERVICE_UNAVAILABLE';
            } else {
                status = HttpStatus.INTERNAL_SERVER_ERROR;
                message = 'Error interno del servidor. Por favor, intenta nuevamente.';
                errorCode = 'INTERNAL_ERROR';
            }
        }

        // Log del error
        this.logger.error(
            `HTTP ${status} Error: ${message}`,
            exception instanceof Error ? exception.stack : undefined,
            `${request.method} ${request.url}`,
        );

        // Respuesta estructurada
        const errorResponse = {
            statusCode: status,
            message,
            errorCode,
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
        };

        response.status(status).json(errorResponse);
    }
}
