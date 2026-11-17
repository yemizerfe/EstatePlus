
import 'express-async-errors';

import { logger } from '../shared/utils/logger';

async function startWorkers(): Promise<void> {
  logger.info(
    'Background workers are disabled. Kafka and RabbitMQ are not configured.'
  );
}

startWorkers().catch((err) => {
  logger.error({ msg: 'Worker startup failed', err });
  process.exit(1);
});
