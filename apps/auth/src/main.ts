import { bootstrapMicroservice } from '../../common/bootstrap-microservice';
import { AuthServiceModule } from './auth-service.module';

bootstrapMicroservice({
  serviceName: 'Auth',
  module: AuthServiceModule,
  healthCheckPort: 3001,
}).catch((error) => {
  console.error('Failed to start auth service:', error);
  process.exit(1);
});
