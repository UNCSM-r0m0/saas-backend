import { bootstrapMicroservice } from '../../common/bootstrap-microservice';
import { BillingServiceModule } from './billing-service.module';

bootstrapMicroservice({
  serviceName: 'Billing',
  module: BillingServiceModule,
  healthCheckPort: 3004,
}).catch((error) => {
  console.error('Failed to start billing service:', error);
  process.exit(1);
});
