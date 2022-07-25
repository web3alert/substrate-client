import { TypeDefInfo } from '@polkadot/types';
import type { TypeDef } from '@polkadot/types/types';
import type { ILookup } from '@polkadot/types-create/types';
import type {
  PartialRecord,
  About,
} from '../types';
import type { Multiset } from './multiset';
import * as spec from './type-specs';
import * as parser from './type-parsers';

export type Context = {
  about: About;
  wrappers: {
    index: PartialRecord<TypeDefInfo, Mapper>;
    unknowns: Multiset<TypeDefInfo>;
    get: Mapper;
  };
  primitives: {
    index: PartialRecord<string, Mapper>;
    unknowns: {
      basic: Multiset<string>;
      complex: Multiset<string>;
    };
    get: Mapper;
  };
  lookup: ILookup;
};

export type Handler = {
  spec: spec.Spec;
  parse: parser.Parser;
};

export type Mapper = (
  ctx: Context,
  source: TypeDef,
  path: string,
) => Handler;

const unknown: Handler = {
  spec: spec.unknown(),
  parse: parser.raw(),
};

const skip: Handler = {
  spec: spec.skip(),
  parse: parser.raw(),
};

export const DEFAULT_WRAPPER_MAPPERS: PartialRecord<TypeDefInfo, Mapper> = {
  [TypeDefInfo.Compact]: (ctx, source, path) => {
    const sub = { ...source.sub! as TypeDef };
    
    if (source.typeName) {
      sub.typeName = source.typeName;
    }
    
    return ctx.wrappers.get(ctx, sub, path);
  },
  [TypeDefInfo.Plain]: (ctx, source, path) => {
    return ctx.primitives.get(ctx, source, path);
  },
};

type PrimitiveMapperBinding = {
  keys: string[];
  mapper: Mapper;
};

function bind(
  keys: string[],
  mapper: Mapper,
): PrimitiveMapperBinding {
  return { keys, mapper };
}

const DEFAULT_PRIMITIVE_MAPPER_BINDINGS: PrimitiveMapperBinding[] = [
  bind([
    'ParaId', 'ValidationCode', 'HeadData', 'ValidationCodeHash', 'CandidateHash',
  ], (ctx, source, path) => {
    return {
      spec: spec.skip(),
      parse: parser.raw(),
    };
  }),
  bind([
    'bool',
  ], (ctx, source, path) => {
    return {
      spec: spec.bool(),
      parse: parser.bool(),
    };
  }),
  bind([
    'u8', 'u16', 'u32',
  ], (ctx, source, path) => {
    return {
      spec: spec.int(),
      parse: parser.int(),
    };
  }),
  bind([
    'u64', 'u128',
  ], (ctx, source, path) => {
    return {
      spec: spec.bigint(),
      parse: parser.bigint(),
    };
  }),
  bind([
    'Balance', 'BalanceOf',
  ], (ctx, source, path) => {
    return {
      spec: spec.balance(),
      parse: parser.balance(),
    };
  }),
  bind([
    'CurrencyId',
  ], (ctx, source, path) => {
    return {
      spec: spec.currency(),
      parse: parser.raw(),
    };
  }),
  bind([
    'Bytes',
  ], (ctx, source, path) => {
    return {
      spec: spec.string(),
      parse: parser.human(),
    };
  }),
  bind([
    'H256',
  ], (ctx, source, path) => {
    return {
      spec: spec.hash(),
      parse: parser.string(),
    };
  }),
  // TODO: check for MultiAddress and AccountId20 compatibility
  bind([
    'AccountId32', /* 'MultiAddress', */
  ], (ctx, source, path) => {
    return {
      spec: spec.address({ addressFormat: 'substrate', ss58Prefix: ctx.about.chain.ss58Prefix! }),
      parse: parser.string(),
    };
  }),
  // TODO: check for AccountId32 compatibility
  bind([
    'MultiAddress',
  ], (ctx, source, path) => {
    return {
      spec: spec.address({ addressFormat: 'substrate', ss58Prefix: ctx.about.chain.ss58Prefix! }),
      parse: parser.string(),
    };
  }),
  // TODO: check for MultiAddress compatibility
  bind([
    'AccountId20', /* 'EthereumAddress', */
  ], (ctx, source, path) => {
    return {
      spec: spec.address({ addressFormat: 'evm' }),
      parse: parser.string(),
    };
  }),
];

function buildIndex(
  bindings: PrimitiveMapperBinding[],
): PartialRecord<string, Mapper> {
  const index: PartialRecord<string, Mapper> = {};
  for (const item of bindings) {
    for (const key of item.keys) {
      index[key] = item.mapper;
    }
  }
  
  return index;
}

export const DEFAULT_PRIMITIVE_MAPPERS = buildIndex(DEFAULT_PRIMITIVE_MAPPER_BINDINGS);

export const wrapper: Mapper = (ctx, source, path) => {
  const index = ctx.wrappers.index;
  const key = source.info;
  const mapper = index[key];
  
  if (mapper) {
    return mapper(ctx, source, path);
  } else {
    ctx.wrappers.unknowns.add(key, path);
    
    return unknown;
  }
};

export const primitive: Mapper = (ctx, source, path) => {
  const index = ctx.primitives.index;
  let key = source.type;
  
  if (source.typeName != undefined) {
    if (index[source.typeName]) {
      key = source.typeName;
    } else {
      ctx.primitives.unknowns.complex.add(source.typeName, path);
    }
  }
  
  const mapper = index[key];
  
  if (mapper) {
    return mapper(ctx, source, path);
  } else {
    ctx.primitives.unknowns.basic.add(key, path);
    
    return unknown;
  }
};
