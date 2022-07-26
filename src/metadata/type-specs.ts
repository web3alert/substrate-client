export type Unknown = {
  type: 'unknown';
};

export type Skip = {
  type: 'skip';
};

export type Bool = {
  type: 'bool';
};

export type Int = {
  type: 'int';
};

export type Bigint = {
  type: 'bigint';
};

export type BalancyCurrencyPlain = {
  plain: string;
};

export type BalanceCurrencyLookup = {
  lookup: {
    match: string;
    replace: string;
  };
};

export type BalanceCurrency =
  | BalancyCurrencyPlain
  | BalanceCurrencyLookup
;

export type Balance = {
  type: 'balance';
  currency?: BalanceCurrency;
};

export type Currency = {
  type: 'currency';
};

export type String = {
  type: 'string';
};

export type Hash = {
  type: 'hash';
};

export type AddressSubstrate = {
  type: 'address';
  addressFormat: 'substrate';
  ss58Prefix: number;
};

export type AddressEvm = {
  type: 'address';
  addressFormat: 'evm';
};

export type Address =
  | AddressSubstrate
  | AddressEvm
;

export type Primitive =
  | Unknown
  | Skip
  | Bool
  | Int
  | Bigint
  | Balance
  | Currency
  | String
  | Hash
  | Address
;

export type Map = {
  type: 'map';
  keys: String | Int;
  values: Spec;
};

export type Object = {
  type: 'object';
  props: Record<string, Spec>;
};

export type Array = {
  type: 'array';
  items: Spec;
};

export type Tuple = {
  type: 'tuple';
  items: Spec[];
};

export type Wrapper =
  | Map
  | Object
  | Array
  | Tuple
;

export type Spec =
  | Primitive
  | Wrapper
;

export function unknown(): Unknown {
  return { type: 'unknown' };
}

export function skip(): Skip {
  return { type: 'skip' };
}

export function bool(): Bool {
  return { type: 'bool' };
}

export function int(): Int {
  return { type: 'int' };
}

export function bigint(): Bigint {
  return { type: 'bigint' };
}

export function balance(): Balance {
  return { type: 'balance' };
}

export function currency(): Currency {
  return { type: 'currency' };
}

export function string(): String {
  return { type: 'string' };
}

export function hash(): Hash {
  return { type: 'hash' };
}

export type AddressOptionsSubstrate = {
  addressFormat: 'substrate';
  ss58Prefix: number;
};

export type AddressOptionsEvm = {
  addressFormat: 'evm';
};

export type AddressOptions = AddressOptionsSubstrate | AddressOptionsEvm;

export function address(options: AddressOptions): Address {
  return { type: 'address', ...options };
}

export type MapOptions = {
  keys: String | Int;
  values: Spec;
};

export function map(options: MapOptions): Map {
  return { type: 'map', ...options };
};

export type ObjectOptions = {
  props: Record<string, Spec>;
};

export function object(options: ObjectOptions): Object {
  return { type: 'object', ...options };
};

export type ArrayOptions = {
  items: Spec;
};

export function array(options: ArrayOptions): Array {
  return { type: 'array', ...options };
}

export type TupleOptions = {
  items: Spec[];
};

export function tuple(options: TupleOptions): Tuple {
  return { type: 'tuple', ...options };
}
