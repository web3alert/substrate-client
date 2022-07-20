import type { MetadataV14 } from '@polkadot/types/interfaces';
import type {
  ErrorDetails,
  About,
  EventSpec,
} from '../types';
import { parse } from './parse';
import { TypeRegistry } from './type-registry';

export interface MetadataOptions {
  about: About;
  source: MetadataV14;
}

export class Metadata {
  private index: Map<string, EventSpec>;
  
  public about: About;
  public types: TypeRegistry;
  public events: EventSpec[];
  public errors: ErrorDetails[];
  
  constructor(options: MetadataOptions) {
    const {
      about,
      source,
    } = options;
    
    const types = new TypeRegistry({
      about,
      lookup: source.lookup,
    });
    
    const parsed = parse(source, types);
    
    this.index = new Map();
    for (const event of parsed.items) {
      this.index.set(event.name.full, event);
    }
    
    this.about = about;
    this.types = types;
    this.events = parsed.items;
    this.errors = parsed.errors;
  }
  
  public get(eventFullName: string): EventSpec | undefined {
    return this.index.get(eventFullName);
  }
}
