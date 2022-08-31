import type { EventSpec } from '../../types';
import type * as spec from '../type-specs';
import type { AutomagicContext } from './types';

type IsPredicate = (spec: spec.Spec) => boolean;

function isType(type: string): IsPredicate {
  return spec => spec.type == type;
}

const isBalance = isType('balance');
const isCurrency = isType('currency');

function isArrayOfType(type: string): IsPredicate {
  return spec => spec.type == 'array' && spec.items.type == type;
}

const isArrayOfBalances = isArrayOfType('balance');
const isArrayOfCurrencies = isArrayOfType('currency');

function isTupleOfTwo(type: string): IsPredicate {
  return spec => spec.type == 'tuple'
    && spec.items.length == 2
    && spec.items[0].type == type
    && spec.items[1].type == type
  ;
}

const isTupleOfTwoCurrencies = isTupleOfTwo('currency');

function countArgs(event: EventSpec, is: IsPredicate): number {
  let count = 0;
  
  for (const arg of event.args) {
    if (is(arg.spec)) {
      count++;
    }
  }
  
  return count;
}

function asParallelArrays(ctx: AutomagicContext, event: EventSpec): void {
  const arrayOfBalancesArg = event.args.find(item => isArrayOfBalances(item.spec))!;
  const arrayOfCurrenciesArg = event.args.find(item => isArrayOfCurrencies(item.spec))!;
  
  const arrayOfBalancesArgSpec = arrayOfBalancesArg.spec as spec.Array;
  const balanceSpec = arrayOfBalancesArgSpec.items as spec.Balance;
  
  balanceSpec.currency = {
    lookup: {
      match: '^(?<prefix>(?:[a-zA-Z0-9-_]+\.)*?)(?:[a-zA-Z0-9-_]+)\.(?<index>[0-9]+)$',
      replace: `$<prefix>${arrayOfCurrenciesArg.name}.$<index>`,
    },
  };
}

function asOneToOne(ctx: AutomagicContext, event: EventSpec): void {
  const balanceArg = event.args.find(item => isBalance(item.spec))!;
  const balanceArgSpec = balanceArg.spec as spec.Balance;
  const currencyArg = event.args.find(item => isCurrency(item.spec))!;
  
  balanceArgSpec.currency = {
    lookup: {
      match: '^.*$',
      replace: currencyArg.name,
    },
  };
}

function asCommonSetWithTuplesOfTwoCurrencies(ctx: AutomagicContext, event: EventSpec): void {
  const balanceArgs = event.args.filter(item => isBalance(item.spec));
  const tupleOfTwoCurrenciesArgs = event.args.filter(item => isTupleOfTwoCurrencies(item.spec));
  const count = balanceArgs.length;
  
  for (let i = 0; i < count; i++) {
    const balance = balanceArgs[i];
    const tuple = tupleOfTwoCurrenciesArgs[i];
    
    const asBalance = balance.spec as spec.Balance;
    asBalance.currency = {
      lookup: {
        match: '^.*$',
        replace: `${tuple.name}.0`,
      },
      lookup2: {
        match: '^.*$',
        replace: `${tuple.name}.1`,
      },
    };
  }
}

function asDefault(ctx: AutomagicContext, event: EventSpec): void {
  for (const arg of event.args) {
    if (isBalance(arg.spec)) {
      const asBalance = arg.spec as spec.Balance;
      
      asBalance.currency = { plain: ctx.about.chain.tokens[0] };
    }
  }
}

export function detectBalanceCurrency(ctx: AutomagicContext, event: EventSpec): void {
  const balanceArgsCount = countArgs(event, isBalance);
  const currencyArgsCount = countArgs(event, isCurrency);
  const arrayOfBalancesArgsCount = countArgs(event, isArrayOfBalances);
  const arrayOfCurrenciesArgsCount = countArgs(event, isArrayOfCurrencies);
  const tupleOfTwoCurrenciesArgsCount = countArgs(event, isTupleOfTwoCurrencies);
  
  if (arrayOfBalancesArgsCount == 1 && arrayOfCurrenciesArgsCount == 1) {
    asParallelArrays(ctx, event);
  } else if (balanceArgsCount == 1 && currencyArgsCount == 1) {
    asOneToOne(ctx, event);
  } else if (balanceArgsCount == tupleOfTwoCurrenciesArgsCount) {
    asCommonSetWithTuplesOfTwoCurrencies(ctx, event);
  } else if (balanceArgsCount > 0 && currencyArgsCount == 0) {
    asDefault(ctx, event);
  }
}
