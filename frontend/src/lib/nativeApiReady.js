import { androidApiFetchEnabled } from './androidApiFetch';
import { electronApiFetchEnabled } from './electronApiFetch';

export async function waitForNativeApiBridge(maxMs = 5000) {
  if (electronApiFetchEnabled() || androidApiFetchEnabled()) {
    return true;
  }
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    await new Promise((resolve) => setTimeout(resolve, 120));
    if (electronApiFetchEnabled() || androidApiFetchEnabled()) {
      return true;
    }
  }
  return false;
}