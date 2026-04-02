import 'dotenv/config';
import { processNextQueuedRender } from './services/render-processor.js';
import { getWorkerPollIntervalMs } from './services/render-config.js';

const workerName = 'render-worker';
const pollIntervalMs = getWorkerPollIntervalMs();

let inFlight = false;

async function tick(): Promise<void> {
  if (inFlight) {
    return;
  }

  inFlight = true;
  try {
    await processNextQueuedRender();
  } catch (error) {
    console.error(`[${workerName}] unexpected worker error`, error);
  } finally {
    inFlight = false;
  }
}

console.log(`[${workerName}] initialized`);
console.log(`[${workerName}] polling for queued renders every ${pollIntervalMs}ms`);

void tick();
setInterval(() => {
  void tick();
}, pollIntervalMs);
