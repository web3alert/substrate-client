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

export type HandleEventsOptions = {
  filter: Filter;
  metadata: Metadata;
  blockNumber: number;
  eventRecords: EventRecord[];
};

export function handleEvents(options: HandleEventsOptions): Result<Event> {
  const {
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
      result.items.push(handleEvent({
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
