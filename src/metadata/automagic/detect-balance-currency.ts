import type * as spec from '../type-specs';
import type { AutomagicContext } from './types';

type IsPredicate = (spec: spec.Spec) => boolean;

function isType(types: string[]): IsPredicate {
  return spec => types.find(t => t == spec.type) != undefined;
}

const isBalance = isType(['balance']);
const isCurrency = isType(['currency','currency_pair'])
const isObjectSpec = isType(['object']);

function isArrayOfType(type: string): IsPredicate {
  return spec => spec.type == 'array' && spec.items.type == type;
}

const isArrayOfBalances = isArrayOfType('balance');
const isArrayOfCurrencies = isArrayOfType('currency');
const isArrayOfTuple = isArrayOfType('tuple')

function isTupleOfTwo(type: string): IsPredicate {
  return spec => spec.type == 'tuple'
    && spec.items.length == 2
    && spec.items[0].type == type
    && spec.items[1].type == type
    ;
}

function isTupleOfPair(first:string, second:string): IsPredicate {
  return spec => spec.type == 'tuple'
    && spec.items.length == 2
    && spec.items[0].type == first
    && spec.items[1].type == second
}
function isArrayOfTupleOfPair(first:string, second:string): IsPredicate {
  return spec => spec.type == 'array'
    && spec.items.type == 'tuple'
    && spec.items.items[0].type == first
    && spec.items.items[1].type == second
}

const isTupleOfTwoCurrencies = isTupleOfTwo('currency');
const isTupleOfPairBalanceCurrency = isTupleOfPair('currency', 'balance')
const isArrayOfTupleOfPairBalanceCurrency = isArrayOfTupleOfPair('currency', 'balance')

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

function asManyToOne(specs: spec.NamedSpec[]): void {
  const balanceArgs = specs.filter(item => isBalance(item.spec));
  const currencyArg = specs.find(item => isCurrency(item.spec))!;
  const count = balanceArgs.length;
  for (let i = 0; i < count; i++) {
    const balanceArg = balanceArgs[i];
    const balanceArgSpec = balanceArg.spec as spec.Balance;
    balanceArgSpec.currency = {
      lookup: {
        match: '[^.]+$',
        replace: currencyArg.name,
      },
    };
  }
}

function asManyToMany(specs: spec.NamedSpec[]): void {
  const balanceArgs = specs.filter(item => isBalance(item.spec));
  const currencyArgs = specs.filter(item => isCurrency(item.spec));
  const count = balanceArgs.length;
  for (let i = 0; i < count; i++) {
    const balanceArg = balanceArgs[i];
    const balanceArgSpec = balanceArg.spec as spec.Balance;
    balanceArgSpec.currency = {
      lookup: {
        match: '[^.]+$',
        replace: currencyArgs[i].name,
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
        match: '[^.]+$',
        replace: `${tuple.name}.0`,
      },
      lookup2: {
        match: '[^.]+$',
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

function asTupleOfPair(ctx: AutomagicContext, specs: spec.NamedSpec[]): void {
  const tupleOfPairs = specs.filter(item => isTupleOfPairBalanceCurrency(item.spec));
  for (let i = 0; i < tupleOfPairs.length; i++) {
    const namedTuple = tupleOfPairs[i]
    const tuple = namedTuple.spec as spec.Tuple
    const asBalance = tuple.items[1] as spec.Balance
    asBalance.currency = {
      lookup: {
        match: '[^.]+$',
        replace: `${namedTuple.name}.0`,
      },
    };
  }
}

function asArrayOfTupleOfPair(ctx: AutomagicContext, specs: spec.NamedSpec[]): void {
  const arrayOfTupleArgs = specs.filter(item => isArrayOfTupleOfPairBalanceCurrency(item.spec))!;
  for (let i = 0; i < arrayOfTupleArgs.length; i++) {
    const arrayOfTuple = arrayOfTupleArgs[i]
    const tuple = (arrayOfTuple.spec as spec.Array).items as spec.Tuple
    const asBalance = tuple.items[1] as spec.Balance
    asBalance.currency = {
      lookup: {
        match: `^(${arrayOfTuple.name}\.\(?<index>[0-9]+)\.)(1)$`,
        replace: `${arrayOfTuple.name}.$<index>.0`,
      },
    }
  }
}

export function detectBalanceCurrency(ctx: AutomagicContext, specs: spec.NamedSpec[]): void {
  const balanceArgsCount = countArgs(specs, isBalance);
  const currencyArgsCount = countArgs(specs, isCurrency);
  const arrayOfBalancesArgsCount = countArgs(specs, isArrayOfBalances);
  const arrayOfCurrenciesArgsCount = countArgs(specs, isArrayOfCurrencies);
  const tupleOfTwoCurrenciesArgsCount = countArgs(specs, isTupleOfTwoCurrencies);
  const tupleOfPairBalanceCurrency = countArgs(specs, isTupleOfPairBalanceCurrency);
  const arrayOfTupleOfPair = countArgs(specs, isArrayOfTupleOfPairBalanceCurrency);

  if (arrayOfBalancesArgsCount == 1 && arrayOfCurrenciesArgsCount == 1) {
    asParallelArrays(specs);
  } else if (balanceArgsCount > 0 && currencyArgsCount > 0 && balanceArgsCount == currencyArgsCount) {
    asManyToMany(specs);
  } else if (balanceArgsCount == tupleOfTwoCurrenciesArgsCount) {
    asCommonSetWithTuplesOfTwoCurrencies(specs);
  } else if (balanceArgsCount > 1 && currencyArgsCount == 1) {
    asManyToOne(specs);
  } else if (balanceArgsCount > 0 && currencyArgsCount == 0) {
    asDefault(ctx, specs);
  }

  if(tupleOfPairBalanceCurrency > 0){
    asTupleOfPair(ctx, specs)
  }
  if(arrayOfTupleOfPair > 0){
    asArrayOfTupleOfPair(ctx, specs)
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