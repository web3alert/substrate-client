import type { LegacyTypeHandler } from './legacy-type-handlers';
import * as handlers from './legacy-type-handlers';

export type LegacyTypeRegistryOptions = {
  decimals: number;
  map: Record<string, number[] | undefined>;
};

export class LegacyTypeRegistry {
  private unknown: LegacyTypeHandler;
  private index: Map<number, LegacyTypeHandler>;
  
  constructor(options: LegacyTypeRegistryOptions) {
    const {
      decimals,
      map,
    } = options;
    
    this.unknown = handlers.unknown();
    
    this.index = new Map();
    this.register(map['string'], handlers.string());
    this.register(map['bytes'], handlers.bytes());
    this.register(map['number'], handlers.number());
    this.register(map['bigint'], handlers.bigint());
    this.register(map['bool'], handlers.bool());
    this.register(map['address'], handlers.address());
    this.register(map['balance'], handlers.balance({ decimals }));
  }
  
  private register(codes: number[] | undefined, handler: LegacyTypeHandler): void {
    if (!codes) {
      return;
    }
    
    for (const code of codes) {
      this.index.set(code, handler);
    }
  }
  
  public get(type: number): LegacyTypeHandler {
    return this.index.get(type) || this.unknown;
  }
}
