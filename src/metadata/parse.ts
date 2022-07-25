import type { MetadataV14 } from '@polkadot/types/interfaces';
import type { EventSpec } from '../types';
import { Result } from '../utils';
import type { TypeRegistry } from './type-registry';
import { parseEvents } from './parse-events';
import { parseCalls } from './parse-calls';
import {
  AutomagicContext,
  applyAutomagic,
} from './automagic';

export function parse(source: MetadataV14, types: TypeRegistry): Result<EventSpec> {
  const result = new Result<EventSpec>();
  
  result.merge(parseEvents(source, types));
  result.merge(parseCalls(source, types));
  
  result.items.sort((a, b) => {
    if (a.name.full < b.name.full) {
      return -1;
    } else if (a.name.full > b.name.full) {
      return 1;
    } else {
      return 0;
    }
  });
  
  const automagicContext: AutomagicContext = {
    about: types.about,
  };
  
  for (const event of result.items) {
    applyAutomagic(automagicContext, event);
  }
  
  return result;
}
