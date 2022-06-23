import { paramCase } from 'change-case';
import type {
  ErrorDetails,
  EventNameSource,
  EventName,
} from './types';

export class Result<T> {
  public items: T[];
  public errors: ErrorDetails[];
  
  constructor() {
    this.items = [];
    this.errors = [];
  }
  
  public merge(other: Result<T>): void {
    this.items = this.items.concat(other.items);
    this.errors = this.errors.concat(other.errors);
  }
}

export function buildEventName(source: EventNameSource): EventName {
  const moduleName = paramCase(source.module);
  const eventName = paramCase(source.event);
  const short = `${moduleName}.${eventName}`;
  
  return {
    source: {
      kind: source.kind,
      module: moduleName,
      event: eventName,
    },
    short,
    full: `${source.kind}.${short}`,
  };
}
