import _ from 'lodash';
import type {
  Int,
  Struct,
  Vec,
  Tuple,
} from '@polkadot/types';
import type {
  Codec,
  AnyJson,
} from '@polkadot/types/types';
import type { CurrencyInfo } from '../types';
import type { CurrencyRegistry } from './currency-registry';
import type * as spec from './type-specs';

export type ParserContext = {
  currencies: CurrencyRegistry;
  path: string[];
  spec: spec.Spec;
  rawArgs: Record<string, AnyJson>;
};

export type Parser<T extends AnyJson = AnyJson> = (value: Codec, ctx: ParserContext) => T;

function isPlainCurrency(currency: spec.BalanceCurrency): currency is spec.BalancyCurrencyPlain {
  return 'plain' in currency;
};

export function raw(): Parser<AnyJson> {
  return value => value.toJSON();
}

export function human(): Parser<AnyJson> {
  return value => value.toHuman();
}

export function bool(): Parser<boolean> {
  return value => value.toJSON() as boolean;
}

export function int(): Parser<number> {
  return value => value.toJSON() as number;
}

export function bigint(): Parser<number> {
  return value => Number((value as Int).toBigInt());
}

export type FixedPointOptions = {
  decimals: number;
};

export function fixedPoint(options: FixedPointOptions): Parser<number> {
  const {
    decimals,
  } = options;
  
  return value => {
    const raw = Number((value as Int).toBigInt());
    
    return raw / Math.pow(10, decimals);
  }
}

export type BalanceOptions = {
  parseRaw?: Parser<number>;
};

export function balance(options?: BalanceOptions): Parser<number> {
  const parseRaw: Parser<number> = options?.parseRaw || raw() as Parser<number>;
  
  return (value, ctx) => {
    const specAsBalance = ctx.spec as spec.Balance;
    const raw = parseRaw(value, ctx);
    
    if (specAsBalance.currency) {
      let currency: CurrencyInfo | undefined = undefined;
      
      if (isPlainCurrency(specAsBalance.currency)) {
        const symbol = specAsBalance.currency.plain;
        
        currency = ctx.currencies.get(symbol);
      } else {
        const lookup = specAsBalance.currency.lookup;
        const lookupPath = ctx.path
          .join('.')
          .replace(new RegExp(lookup.match), lookup.replace)
          .split('.')
        ;
        
        const currencyArgValueDecoded = _.get(ctx.rawArgs, lookupPath);
        
        // 🌈​🦄​🦋​✨🥰
        if (typeof currencyArgValueDecoded == 'object' && currencyArgValueDecoded['token']) {
          const symbol = currencyArgValueDecoded['token'];
          
          if (typeof symbol == 'string') {
            currency = ctx.currencies.get(symbol);
          }
        }
      }
      
      if (currency) {
        return raw / Math.pow(10, currency.decimals);
      }
    }
    
    return raw;
  };
}

export function string(): Parser<string> {
  return value => value.toString() as string;
}

export type ObjectOptions = {
  propParsers: Record<string, Parser>;
};

export function object(options: ObjectOptions): Parser<Record<string, AnyJson>> {
  const {
    propParsers,
  } = options;
  
  const keys = Object.keys(propParsers);
  
  return (value, ctx) => {
    const specAsObject = ctx.spec as spec.Object;
    const asStruct = value as Struct;
    
    const result: Record<string, AnyJson> = {};
    for (const key of keys) {
      result[key] = propParsers[key](asStruct.get(key)!, {
        currencies: ctx.currencies,
        path: [...ctx.path, key],
        spec: specAsObject.props[key],
        rawArgs: ctx.rawArgs,
      });
    }
    
    return result;
  };
}

export type ArrayOptions<T extends AnyJson> = {
  parseItem: Parser<T>;
};

export function array<T extends AnyJson = AnyJson>(options: ArrayOptions<T>): Parser<T[]> {
  const {
    parseItem,
  } = options;
  
  return (value, ctx) => {
    const specAsArray = ctx.spec as spec.Array;
    const asArray = value as Vec<Codec>;
    
    return asArray.map((item, index) => {
      return parseItem(item, {
        currencies: ctx.currencies,
        path: [...ctx.path, '' + index],
        spec: specAsArray.items,
        rawArgs: ctx.rawArgs,
      });
    });
  };
}

export type TupleOptions = {
  itemParsers: Parser[];
};

export function tuple(options: TupleOptions): Parser<AnyJson[]> {
  const {
    itemParsers,
  } = options;
  
  return (value, ctx) => {
    const specAsTuple = ctx.spec as spec.Tuple;
    const asTuple = value as Tuple;
    
    return asTuple.map((item, index) => {
      const parseItem = itemParsers[index];
      
      return parseItem(item, {
        currencies: ctx.currencies,
        path: [...ctx.path, '' + index],
        spec: specAsTuple.items[index],
        rawArgs: ctx.rawArgs,
      });
    });
  };
}
