import type { Codec } from '@polkadot/types/types';
import type {
  Object,
  EventName,
  Event,
} from './types';
import type {
  parser,
  Metadata,
} from './metadata';
import { error } from './error';

export interface HandleEventOptions {
  metadata: Metadata;
  blockNumber: number;
  index: number | null;
  event: {
    name: EventName;
    argValues: Codec[];
    argTypes: number[];
  };
}

export function handleEvent(options: HandleEventOptions): Event {
  const {
    metadata,
    blockNumber,
    index,
    event,
  } = options;
  
  const eventSpec = metadata.get(event.name.full);
  
  if (!eventSpec) {
    throw error('unknown event', {
      event: event.name.full,
    });
  }
  
  if (event.argValues.length != eventSpec.args.length) {
    throw error('event args count does not match its metadata', {
      event: event.name.full,
      expected: eventSpec.args.length,
      received: event.argValues.length,
    });
  }
  
  const rawArgs: Object = {};
  for (let i = 0; i < event.argValues.length; i++) {
    const argValue = event.argValues[i];
    const argHandler = eventSpec.args[i];
    
    rawArgs[argHandler.name] = argValue.toJSON();
  }
  
  const raw: Object = {};
  const human: Object = {};
  for (let i = 0; i < event.argValues.length; i++) {
    const argValue = event.argValues[i];
    const argHandler = eventSpec.args[i];
    
    const ctx: parser.ParserContext = {
      currencies: metadata.currencies,
      path: [argHandler.name],
      spec: argHandler.spec,
      rawArgs,
    };
    
    raw[argHandler.name] = argHandler.parse.raw(argValue, ctx);
    human[argHandler.name] = argHandler.parse.human(argValue, ctx);
  }
  
  return {
    name: event.name.full,
    params: {
      raw,
      human,
    },
    payload: {
      block: blockNumber,
      index,
    },
  };
}
