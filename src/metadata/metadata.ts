import type { MetadataV14 } from '@polkadot/types/interfaces';
import type {
  ErrorDetails,
  About,
  EventSpec,
} from '../types';
import { parse } from './parse';
import type { LegacyTypeRegistry } from './legacy-type-registry';

export interface MetadataOptions {
  about: About;
  source: MetadataV14;
  legacyTypeRegistry: LegacyTypeRegistry;
}

export class Metadata {
  private index: Map<string, EventSpec>;
  
  public about: About;
  public types: LegacyTypeRegistry;
  public events: EventSpec[];
  public errors: ErrorDetails[];
  
  constructor(options: MetadataOptions) {
    const {
      about,
      source,
      legacyTypeRegistry,
    } = options;
    
    const parsed = parse(source);
    
    this.index = new Map();
    for (const event of parsed.items) {
      this.index.set(event.name.full, event);
    }
    
    this.about = about;
    this.types = legacyTypeRegistry;
    this.events = parsed.items;
    this.errors = parsed.errors;
  }
  
  public get(eventFullName: string): EventSpec | undefined {
    return this.index.get(eventFullName);
  }
}
