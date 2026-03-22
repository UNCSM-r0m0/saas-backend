import { bootstrapMicroservice } from '../../common/bootstrap-microservice';
import { UsersServiceModule } from './users-service.module';

bootstrapMicroservice({
  serviceName: 'Users',
  module: UsersServiceModule,
  healthCheckPort: 3002,
}).catch((error) => {
  console.error('Failed to start users service:', error);
  process.exit(1);
});
