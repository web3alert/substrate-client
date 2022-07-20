import type { Codec } from '@polkadot/types/types';
import type {
  EventName,
  Event,
} from './types';
import type { Metadata } from './metadata';
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
  
  const params: Record<string, unknown> = {};
  
  for (let i = 0; i < event.argValues.length; i++) {
    const argValue = event.argValues[i];
    const argSpec = eventSpec.args[i];
    
    params[argSpec.name] = argSpec.parse(argValue);
  }
  
  return {
    name: event.name.full,
    params,
    payload: {
      block: blockNumber,
      index,
    },
  };
}
