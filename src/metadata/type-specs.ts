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

export type Balance = {
  type: 'balance';
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

export type Spec =
  | Unknown
  | Skip
  | Bool
  | Int
  | Bigint
  | Balance
  | String
  | Hash
  | Address
;

export type AddressOptionsSubstrate = {
  addressFormat: 'substrate';
  ss58Prefix: number;
};

export type AddressOptionsEvm = {
  addressFormat: 'evm';
};

export type AddressOptions = AddressOptionsSubstrate | AddressOptionsEvm;

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

export function string(): String {
  return { type: 'string' };
}

export function hash(): Hash {
  return { type: 'hash' };
}

export function address(options: AddressOptions): Address {
  return { type: 'address', ...options };
}
