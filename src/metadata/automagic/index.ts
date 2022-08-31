import type { EventSpec } from '../../types';
import type { AutomagicContext } from './types';
import { detectBalanceCurrency } from './detect-balance-currency';

export * from './types';

export function applyAutomagic(ctx: AutomagicContext, event: EventSpec): void {
  detectBalanceCurrency(ctx, event.args);
}
