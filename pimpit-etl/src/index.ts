import 'dotenv/config';
import { syncAllSuppliers } from './etl/sync.js';

async function main() {
  try {
    await syncAllSuppliers();
    process.exit(0);
  } catch (error) {
    console.error('Fatal error during sync:', error);
    process.exit(1);
  }
}

main();
