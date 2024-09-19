export type Unknown = {
  type: 'unknown';
};

export type Skip = {
  type: 'skip';
};

export type Null = {
  type: 'null';
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

export type BalancyCurrencyIndex = {
  index: number;
};

export type BalanceCurrencyLookup = {
  lookup: {
    match: string;
    replace: string;
  };
  lookup2?: {
    match: string;
    replace: string;
  };
};

export type BalanceCurrency =
  | BalancyCurrencyPlain
  | BalanceCurrencyLookup
  | BalancyCurrencyIndex
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
  | Null
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

export type CurrencyPair = {
    type: 'currency_pair';
    props: Record<string, Spec>;
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
  | CurrencyPair
  | Array
  | Tuple
;

export type Lookup = {
  type: 'lookup';
  ref: string;
};

export type Spec =
  | Primitive
  | Wrapper
  | Lookup
;

export type NamedSpec = {
  name: string,
  spec: Spec
}

export function unknown(): Unknown {
  return { type: 'unknown' };
}

export function skip(): Skip {
  return { type: 'skip' };
}

export function nullish(): Null {
  return { type: 'null' };
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

export function currency_pair(options: ObjectOptions): CurrencyPair {
  return { type: 'currency_pair', ...options };
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

export type LookupOptions = {
  ref: string;
};

export function lookup(options: LookupOptions): Lookup {
  return { type: 'lookup', ...options };
}
