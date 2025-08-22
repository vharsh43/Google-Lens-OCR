
import { StartupValidator } from './startup-validator';

async function main() {
  try {
    const result = await StartupValidator.validateEnvironment();
    if (!result.success) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Validation failed:', error);
    process.exit(1);
  }
}

main();
