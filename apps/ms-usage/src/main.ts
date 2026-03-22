import { bootstrapMicroservice } from '../../common/bootstrap-microservice';
import { UsageServiceModule } from './usage-service.module';

bootstrapMicroservice({
  serviceName: 'Usage',
  module: UsageServiceModule,
  healthCheckPort: 3005,
}).catch((error) => {
  console.error('Failed to start usage service:', error);
  process.exit(1);
});
