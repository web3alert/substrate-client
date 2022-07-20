import type {
  spec,
  parser,
} from './metadata';

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
  parse: parser.Parser;
};

export type EventSpec = {
  name: EventName;
  docs: string;
  args: EventArgument[];
};

export type Event = {
  name: string;
  params: Record<string, unknown>;
  payload: {
    block: number;
    index: number | null;
  };
};
