import type { TypeDef } from '@polkadot/types/types';
import type {
  spec,
  parser,
} from './metadata';

export type Json = string | number | boolean | null | undefined | Json[] | {
  [key: string]: Json;
};

export type Object = Record<string, Json>;

export type PartialRecord<K extends string | number | symbol, V> = Partial<Record<K, V>>;

export type AddressFormat = 'substrate' | 'evm';

export type About = {
  node: {
    name: string;
    version: string;
  };
  block: {
    number: number;
    hash: string;
  };
  chain: {
    name: string;
    version: number;
    defaultAddressFormat: AddressFormat;
    ss58Prefix: number | undefined;
    tokens: string[];
    decimals: number[];
  };
};

export type ErrorDetails = {
  message: string;
  details?: Record<string, unknown>;
};

export type CurrencyInfo = {
  symbol: string;
  decimals: number;
};

export type EventKind = 'event' | 'call';

export type EventNameSource = {
  kind: EventKind;
  module: string;
  event: string;
};

export type EventName = {
  source: EventNameSource;
  short: string;
  full: string;
};

export type EventArgument = {
  name: string;
  spec: spec.Spec;
  parse: {
    raw: parser.Parser;
    human: parser.Parser;
  };
  debug: {
    typeDef: TypeDef;
    typeName: { raw: string, sanitized: string } | null;
  };
};

export type EventSpec = {
  name: EventName;
  docs: string;
  args: EventArgument[];
};

export type Event = {
  name: string;
  params: {
    raw: Object;
    human: Object;
  };
  payload?: {
    block: number;
    index: number | null;
    [key: string]: Json;
  };
};
