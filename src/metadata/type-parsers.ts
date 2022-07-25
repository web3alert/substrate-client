import _ from 'lodash';
import type {
  Vec,
  Int,
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

export function balance(): Parser<number> {
  return (value, ctx) => {
    const specAsBalance = ctx.spec as spec.Balance;
    const raw = value.toJSON() as number;
    
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
