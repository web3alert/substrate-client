import type { MetadataV14 } from '@polkadot/types/interfaces';
import type { EventSpec } from '../types';
import { Result } from '../utils';
import { parseEvents } from './parse-events';
import { parseCalls } from './parse-calls';

export function parse(source: MetadataV14): Result<EventSpec> {
  const result = new Result<EventSpec>();
  
  result.merge(parseEvents(source));
  result.merge(parseCalls(source));
  
  result.items.sort((a, b) => {
    if (a.name.full < b.name.full) {
      return -1;
    } else if (a.name.full > b.name.full) {
      return 1;
    } else {
      return 0;
    }
  });
  
  return result;
}
