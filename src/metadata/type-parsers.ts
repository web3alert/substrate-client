import type {
  Codec,
  AnyJson,
} from '@polkadot/types/types';
import type { CurrencyInfo } from '../types';

export type ParserContext = {
  currency?: CurrencyInfo;
};

export type Parser<T extends AnyJson = AnyJson> = (value: Codec, ctx?: ParserContext) => T;

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
  return value => value.toJSON() as number;
}

export function balance(): Parser<number> {
  return (value, ctx) => {
    const raw = value.toJSON() as number;
    
    if (ctx?.currency) {
      return raw / Math.pow(10, ctx.currency.decimals);
    } else {
      return raw;
    }
  };
}

export function string(): Parser<string> {
  return value => value.toString() as string;
}
