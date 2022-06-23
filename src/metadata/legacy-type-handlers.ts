import type {
  Codec,
  AnyJson,
} from '@polkadot/types/types';

export type LegacyType =
  | 'unknown'
  | 'string'
  | 'bytes'
  | 'number'
  | 'bigint'
  | 'bool'
  | 'address'
  | 'balance'
;

export type LegacyTypeHandler = (value: Codec) => AnyJson;

export type BalanceOptions = {
  decimals: number;
};

export function unknown(): LegacyTypeHandler {
  return value => value.toJSON();
};

export function string(): LegacyTypeHandler {
  return value => value.toString();
}

export function bytes(): LegacyTypeHandler {
  return value => value.toHuman();
}

export function number(): LegacyTypeHandler {
  return value => value.toJSON();
}

export function bigint(): LegacyTypeHandler {
  return value => value.toJSON();
}

export function bool(): LegacyTypeHandler {
  return value => value.toJSON();
}

export function address(): LegacyTypeHandler {
  return value => value.toString();
}

export function balance(options: BalanceOptions): LegacyTypeHandler {
  const { decimals } = options;
  
  return value => {
    const raw = value.toJSON() as number;
    
    return raw / Math.pow(10, decimals);
  };
}
