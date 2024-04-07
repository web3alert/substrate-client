import type { MetadataV15 } from '@polkadot/types/interfaces';
import type {
  ErrorDetails,
  About,
  EventSpec,
} from '../types';
import type { Filter } from '../filter';
import { parse } from './parse';
import { CurrencyRegistry } from './currency-registry';
import { TypeRegistry } from './type-registry';
import type { TypeMappings } from './type-mappers';

export interface MetadataOptions {
  about: About;
  source: MetadataV15;
  filter: Filter;
  typeMappings?: TypeMappings;
  lookupPathsWhitelist?: string[];
}

export class Metadata {
  private index: Map<string, EventSpec>;
  
  public runtimeVersion: number;
  public about: About;
  public types: TypeRegistry;
  public currencies: CurrencyRegistry;
  public events: EventSpec[];
  public errors: ErrorDetails[];
  
  constructor(options: MetadataOptions) {
    const {
      about,
      source,
      filter,
      typeMappings,
      lookupPathsWhitelist,
    } = options;
    
    const types = new TypeRegistry({
      about,
      wrappers: typeMappings?.wrappers,
      primitives: typeMappings?.primitives,
      lookup: source.lookup,
      lookupPathsWhitelist,
    });
    
    const currencies = new CurrencyRegistry({
      about,
    });
    
    const parsed = parse(source, types, filter);
    
    this.index = new Map();
    for (const event of parsed.items) {
      this.index.set(event.name.full, event);
    }
    
    this.runtimeVersion = about.chain.version;
    this.about = about;
    this.types = types;
    this.currencies = currencies;
    this.events = parsed.items;
    this.errors = parsed.errors;
  }
  
  public get(eventFullName: string): EventSpec | undefined {
    return this.index.get(eventFullName);
  }
}
