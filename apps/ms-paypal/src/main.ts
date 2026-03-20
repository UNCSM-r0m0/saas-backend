import { bootstrapMicroservice } from '../../common/bootstrap-microservice';
import { PaypalModule } from './paypal.module';

bootstrapMicroservice({
  serviceName: 'Paypal',
  module: PaypalModule,
  healthCheckPort: 3006,
}).catch((error) => {
  console.error('Failed to start paypal service:', error);
  process.exit(1);
});
