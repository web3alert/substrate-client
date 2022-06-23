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
  type: number;
  comment: string;
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
