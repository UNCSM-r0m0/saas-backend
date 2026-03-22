import { bootstrapMicroservice } from '../../common/bootstrap-microservice';
import { ChatServiceModule } from './chat-service.module';

bootstrapMicroservice({
  serviceName: 'Chat',
  module: ChatServiceModule,
  healthCheckPort: 3003,
}).catch((error) => {
  console.error('Failed to start chat service:', error);
  process.exit(1);
});
