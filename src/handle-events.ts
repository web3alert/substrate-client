import type { Event } from './types';
import type { Filter } from './filter';
import type { EventRecord } from './event-record';
import type { Metadata } from './metadata';
import {
  Result,
  buildEventName,
} from './utils';
import { handleEvent } from './handle-event';
import {
  isErrorDetails,
  error,
} from './error';
import type { ApiPromise } from '@polkadot/api';

export type HandleEventsOptions = {
  api: ApiPromise,
  filter: Filter;
  metadata: Metadata;
  blockNumber: number;
  eventRecords: EventRecord[];
};

export async function handleEvents(options: HandleEventsOptions): Promise<Result<Event>> {
  const {
    api,
    filter,
    metadata,
    blockNumber,
    eventRecords,
  } = options;
  
  const result = new Result<Event>();
  
  for (const eventRecord of eventRecords) {
    const { event, index } = eventRecord;
    
    const eventName = buildEventName({
      kind: 'event',
      module: event.section,
      event: event.method,
    });
    
    if (!filter.match(eventName.full)) {
      continue;
    }
    
    try {
      result.items.push(await handleEvent({
        api,
        metadata,
        blockNumber,
        index,
        event: {
          name: eventName,
          argValues: event.data,
          argTypes: event.meta.fields.map(field => field.type.toNumber()),
        },
      }));
    } catch (err) {
      if (isErrorDetails(err)) {
        result.errors.push({
          message: err.message,
          details: err.details,
        });
      } else {
        throw error('unknown error', {
          err,
        });
      }
    }
  }
  
  return result;
}
