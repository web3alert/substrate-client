import type { EventSpec } from '../../types';
import type { Balance } from '../type-specs';
import type { AutomagicContext } from './types';

// TODO: support more cases like parallel arrays of currencies and balances

function countArgs(event: EventSpec, type: string): number {
  let count = 0;
  
  for (const arg of event.args) {
    if (arg.spec.type == type) {
      count++;
    }
  }
  
  return count;
}

function asOneToOne(ctx: AutomagicContext, event: EventSpec): void {
  const balanceArg = event.args.find(item => item.spec.type == 'balance')!;
  const balanceArgSpec: Balance = balanceArg.spec as Balance;
  const currencyArg = event.args.find(item => item.spec.type == 'currency')!;
  
  balanceArgSpec.currency = { lookup: currencyArg.name };
}

function asDefault(ctx: AutomagicContext, event: EventSpec): void {
  const balanceArg = event.args.find(item => item.spec.type == 'balance')!;
  const balanceArgSpec: Balance = balanceArg.spec as Balance;
  
  balanceArgSpec.currency = { plain: ctx.about.chain.tokens[0] };
}

export function detectBalanceCurrency(ctx: AutomagicContext, event: EventSpec): void {
  const balanceArgsCount = countArgs(event, 'balance');
  const currencyArgsCount = countArgs(event, 'currency');
  
  if (balanceArgsCount == 1 && currencyArgsCount == 1) {
    asOneToOne(ctx, event);
  } else if (balanceArgsCount == 1 && currencyArgsCount == 0) {
    asDefault(ctx, event);
  }
}
