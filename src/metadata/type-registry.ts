import type { TypeDefInfo } from '@polkadot/types';
import type { TypeDef } from '@polkadot/types/types';
import type { ILookup } from '@polkadot/types-create/types';
import type {
  PartialRecord,
  About,
} from '../types';
import * as mapper from './type-mappers';
import {
  Entry,
  Multiset,
} from './multiset';

export * as spec from './type-specs';
export * as parser from './type-parsers';
export * as mappers from './type-mappers';

export type ChainUnknowns = {
  wrappers: Entry<TypeDefInfo>[];
  primitives: {
    basic: Entry<string>[];
    complex: Entry<string>[];
  };
};

export type TypeRegistryOptions = {
  about: About;
  wrappers?: PartialRecord<TypeDefInfo, mapper.Mapper>;
  primitives?: PartialRecord<string, mapper.Mapper>;
  lookup: ILookup;
  lookupPathsWhitelist?: string[];
};

export class TypeRegistry {
  public about: About;
  public ctx: mapper.Context;
  
  constructor(options: TypeRegistryOptions) {
    const {
      about,
      wrappers,
      primitives,
      lookup,
      lookupPathsWhitelist,
    } = options;
    
    this.about = about;
    
    this.ctx = {
      about,
      seen: new Set(),
      refs: new Map(),
      wrappers: {
        index: wrappers ?? mapper.DEFAULT_WRAPPER_MAPPERS,
        unknowns: new Multiset(),
        get: mapper.wrapper,
      },
      primitives: {
        index: primitives ?? mapper.DEFAULT_PRIMITIVE_MAPPERS,
        unknowns: {
          basic: new Multiset(),
          complex: new Multiset(),
        },
        get: mapper.primitive,
      },
      lookup,
      lookupPathsWhitelist: lookupPathsWhitelist ?? [],
    };
  }
  
  public get(source: TypeDef, path: string): mapper.Handler {
    return this.ctx.wrappers.get(this.ctx, source, path);
  }
  
  public unknowns(): ChainUnknowns {
    return {
      wrappers: this.ctx.wrappers.unknowns.entries(),
      primitives: {
        basic: this.ctx.primitives.unknowns.basic.entries(),
        complex: this.ctx.primitives.unknowns.complex.entries(),
      },
    };
  }
}
