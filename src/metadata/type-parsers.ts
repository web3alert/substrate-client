import type {
  Codec,
  AnyJson,
} from '@polkadot/types/types';

export type ParserContext = {
  token?: {
    symbol: string;
    decimals: number;
  };
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
    if (ctx?.token) {
      const raw = value.toJSON() as number;
      
      return raw / Math.pow(10, ctx.token.decimals); // TODO: fix
    } else {
      return value.toJSON() as number;
    }
  };
}

export function string(): Parser<string> {
  return value => value.toString() as string;
}
