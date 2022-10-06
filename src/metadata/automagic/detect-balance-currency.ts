import type * as spec from '../type-specs';
import type { AutomagicContext } from './types';

type IsPredicate = (spec: spec.Spec) => boolean;

function isType(type: string): IsPredicate {
  return spec => spec.type == type;
}

const isBalance = isType('balance');
const isCurrency = isType('currency');
const isObjectSpec = isType('object');

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

function countArgs(specs: spec.NamedSpec[], is: IsPredicate): number {
  let count = 0;
  
  for (const arg of specs) {
    const spec = arg.spec
    if (is(spec)) {
      count++;
    }
  }
  
  return count;
}

function asParallelArrays(specs: spec.NamedSpec[]): void {
  const arrayOfBalancesArg = specs.find(item => isArrayOfBalances(item.spec))!;
  const arrayOfCurrenciesArg = specs.find(item => isArrayOfCurrencies(item.spec))!;

  const arrayOfBalancesArgSpec = arrayOfBalancesArg.spec as spec.Array;
  const balanceSpec = arrayOfBalancesArgSpec.items as spec.Balance;

  balanceSpec.currency = {
    lookup: {
      match: '^(?<prefix>(?:[a-zA-Z0-9-_]+\.)*?)(?:[a-zA-Z0-9-_]+)\.(?<index>[0-9]+)$',
      replace: `$<prefix>${arrayOfCurrenciesArg.name}.$<index>`,
    },
  };
}

function asOneToOne(specs: spec.NamedSpec[]): void {
  const balanceArg = specs.find(item => isBalance(item.spec))!;
  const balanceArgSpec = balanceArg.spec as spec.Balance;
  const currencyArg = specs.find(item => isCurrency(item.spec))!;
  balanceArgSpec.currency = {
    lookup: {
      match: '^.*$',
      replace: currencyArg.name,
    },
  };
}

function asManyToOne(specs: spec.NamedSpec[]): void {
  const balanceArgs = specs.filter(item => isBalance(item.spec));
  const currencyArg = specs.find(item => isCurrency(item.spec))!;
  const count = balanceArgs.length;
  for (let i = 0; i < count; i++) {
    const balanceArg = balanceArgs[i];
    const balanceArgSpec = balanceArg.spec as spec.Balance;
    balanceArgSpec.currency = {
      lookup: {
        match: '^.*$',
        replace: currencyArg.name,
      },
    };
  }
}

function asCommonSetWithTuplesOfTwoCurrencies(specs: spec.NamedSpec[]): void {
  const balanceArgs = specs.filter(item => isBalance(item.spec));
  const tupleOfTwoCurrenciesArgs = specs.filter(item => isTupleOfTwoCurrencies(item.spec));
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

function asDefault(ctx: AutomagicContext, specs: spec.NamedSpec[]): void {
  for (const arg of specs) {
    if (isBalance(arg.spec)) {
      const asBalance = arg.spec as spec.Balance;

      asBalance.currency = { plain: ctx.about.chain.tokens[0] };
    }
  }
}

export function detectBalanceCurrency(ctx: AutomagicContext, specs: spec.NamedSpec[]): void {
  const balanceArgsCount = countArgs(specs, isBalance);
  const currencyArgsCount = countArgs(specs, isCurrency);
  const arrayOfBalancesArgsCount = countArgs(specs, isArrayOfBalances);
  const arrayOfCurrenciesArgsCount = countArgs(specs, isArrayOfCurrencies);
  const tupleOfTwoCurrenciesArgsCount = countArgs(specs, isTupleOfTwoCurrencies);

  if (arrayOfBalancesArgsCount == 1 && arrayOfCurrenciesArgsCount == 1) {
    asParallelArrays(specs);
  } else if (balanceArgsCount == 1 && currencyArgsCount == 1) {
    asOneToOne(specs);
  } else if (balanceArgsCount == tupleOfTwoCurrenciesArgsCount) {
    asCommonSetWithTuplesOfTwoCurrencies(specs);
  } else if (balanceArgsCount > 1 && currencyArgsCount == 1) {
    asManyToOne(specs);
  } else if (balanceArgsCount > 0 && currencyArgsCount == 0) {
    asDefault(ctx, specs);
  }


  specs.filter(spec => isObjectSpec(spec.spec)).forEach(spec => {
    const objectSpec = spec.spec as spec.Object
    const objectProps: spec.NamedSpec[] = []
    for (let i in objectSpec.props) {
      const prop: spec.NamedSpec = {
        name: i,
        spec: objectSpec.props[i]
      }
      objectProps.push(prop)
    }
    detectBalanceCurrency(ctx, objectProps)
  })
}