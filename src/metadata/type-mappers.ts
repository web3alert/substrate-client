import { TypeDefInfo } from '@polkadot/types';
import type { TypeDef } from '@polkadot/types/types';
import type { ILookup } from '@polkadot/types-create/types';
import type { LookupString } from '@polkadot/types-codec/types';
import type {
  PartialRecord,
  About,
} from '../types';
import type { Multiset } from './multiset';
import * as spec from './type-specs';
import * as parser from './type-parsers';

export type Context = {
  about: About;
  seen: Set<string>;
  refs: Map<string, Handler>;
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
  lookupPathsWhitelist: string[];
};

export type Handler = {
  spec: spec.Spec;
  parse: {
    raw: parser.Parser;
    human: parser.Parser;
  };
};

export type Mapper = (
  ctx: Context,
  source: TypeDef,
  path: string,
) => Handler;

export type TypeMappings = {
  wrappers?: PartialRecord<TypeDefInfo, Mapper>;
  primitives?: PartialRecord<string, Mapper>;
};

const RE_VEC = /^Vec<(.+)>$/;
const RE_OPTION = /^Option<(.+)>$/;
const RE_TUPLE = /^\(((?:[a-zA-Z0-9-_]+,?)*)\)$/;

const unknown: Mapper = (ctx, source, path) => {
  return {
    spec: spec.unknown(),
    parse: {
      raw: parser.unknownRaw(ctx, source, path),
      human: parser.unknownHuman(ctx, source, path),
    },
  }
};

const skip: Handler = {
  spec: spec.skip(),
  parse: {
    raw: parser.raw(),
    human: parser.raw(),
  },
};

export const DEFAULT_WRAPPER_MAPPERS: PartialRecord<TypeDefInfo, Mapper> = {
  // [TypeDefInfo.BTreeMap]: (ctx, source, path) => {
  //   const subs = (source.sub! as TypeDef[]).map(item => ({ ...item }));

  //   const keys = ctx.wrappers.get(ctx, subs[0], `${path}(key)`);
  //   const values = ctx.wrappers.get(ctx, subs[1], `${path}(value)`);

  //   return {
  //     spec: spec.map({
  //       keys: keys.spec as spec.String | spec.Int,
  //       values: values.spec,
  //     }),
  //     parse: {
  //       raw: parser.map({
  //         keysParser: keys.parse.raw as parser.Parser<string | number>,
  //         valuesParser: values.parse.raw,
  //       }),
  //       human: parser.map({
  //         keysParser: keys.parse.human as parser.Parser<string | number>,
  //         valuesParser: values.parse.human,
  //       })
  //     }
  //     ,
  //   };
  // },
  [TypeDefInfo.Compact]: (ctx, source, path) => {
    const sub = { ...source.sub! as TypeDef };

    if (source.typeName) {
      sub.typeName = source.typeName;
    }

    return ctx.wrappers.get(ctx, sub, path);
  },
  [TypeDefInfo.Enum]: (ctx, source, path) => {
    const subs = (source.sub! as TypeDef[]).map(item => ({ ...item }));

    const props: Record<string, spec.Spec> = {};
    const parsersRaw: Record<string, parser.Parser> = {};
    const parsersHuman: Record<string, parser.Parser> = {};

    for (const sub of subs) {
      const name = sub.name!;
      const handler = ctx.wrappers.get(ctx, sub, `${path}.${name}`);

      props[name] = handler.spec;
      parsersRaw[name] = handler.parse.raw;
      parsersHuman[name] = handler.parse.human;
    }

    return {
      spec: spec.object({ props }),
      parse: {
        raw: parser.enumObject({ propParsers: parsersRaw }),
        human: parser.humanEnumObject({ propParsers: parsersHuman }),
      },
    };
  },
  [TypeDefInfo.Null]: (ctx, source, path) => {
    return {
      spec: spec.nullish(),
      parse: {
        raw: parser.raw(),
        human: parser.human(),
      },
    };
  },
  [TypeDefInfo.Plain]: (ctx, source, path) => {
    return ctx.primitives.get(ctx, source, path);
  },
  [TypeDefInfo.Si]: (ctx, source, path) => {
    const sub = ctx.lookup.getTypeDef(source.type as LookupString);
    const ref = sub.lookupName!;
    
    if (!ctx.seen.has(ref)) {
      ctx.seen.add(ref);
      ctx.refs.set(ref, ctx.wrappers.get(ctx, sub, path));
    }
    
    return {
      spec: spec.lookup({ ref: `substrate.${ref}` }),
      parse: {
        raw: parser.lookupRaw({ ref }),
        human: parser.lookupHuman({ ref }),
      },
    };
  },
  [TypeDefInfo.Struct]: (ctx, source, path) => {
    const subs = (source.sub! as TypeDef[]).map(item => ({ ...item }));

    const props: Record<string, spec.Spec> = {};
    const parsersRaw: Record<string, parser.Parser> = {};
    const parsersHuman: Record<string, parser.Parser> = {};

    for (const sub of subs) {
      const name = sub.name!;
      const handler = ctx.wrappers.get(ctx, sub, `${path}.${name}`);

      props[name] = handler.spec;
      parsersRaw[name] = handler.parse.raw;
      parsersHuman[name] = handler.parse.human;
    }

    return {
      spec: spec.object({ props }),
      parse: {
        raw: parser.object({ propParsers: parsersRaw }),
        human: parser.object({ propParsers: parsersHuman }),
      },
    };
  },
  [TypeDefInfo.Tuple]: (ctx, source, path) => {
    const subs = (source.sub! as TypeDef[]).map(item => ({ ...item }));

    if (source.typeName) {
      const match = source.typeName.match(RE_TUPLE);

      if (match) {
        const names = match[1].split(',');

        if (subs.length == names.length) {
          for (let i = 0; i < subs.length; i++) {
            subs[i].typeName = names[i];
          }
        }
      }
    }

    const items = subs.map((sub, index) => {
      return ctx.wrappers.get(ctx, sub, `${path}[${index}]`);
    });

    return {
      spec: spec.tuple({ items: items.map(item => item.spec) }),
      parse: {
        raw: parser.tuple({ itemParsers: items.map(item => item.parse.raw) }),
        human: parser.tuple({ itemParsers: items.map(item => item.parse.human) }),
      },
    };
  },
  [TypeDefInfo.Vec]: (ctx, source, path) => {
    const sub = { ...source.sub! as TypeDef };

    if (source.typeName) {
      const match = source.typeName.match(RE_VEC);

      if (match) {
        sub.typeName = match[1];
      }
    }

    const itemsHandler = ctx.wrappers.get(ctx, sub, `${path}[$]`);

    return {
      spec: spec.array({ items: itemsHandler.spec }),
      parse: {
        raw: parser.array({ parseItem: itemsHandler.parse.raw }),
        human: parser.humanArray({ parseItem: itemsHandler.parse.human }),
      },
    };
  },
  [TypeDefInfo.Option]: (ctx, source, path) => {
    const sub = { ...source.sub! as TypeDef };

    if (source.typeName) {
      const match = source.typeName.match(RE_OPTION);
      if (match) {
        sub.typeName = match[1];
      }
    }
    const subHandler = ctx.wrappers.get(ctx, sub, path);
    return {
      spec: subHandler.spec,
      parse: {
        raw: parser.option({ parseItem: subHandler.parse.raw }),
        human: parser.option({ parseItem: subHandler.parse.human }),
      }
    }
  },
};

export type PrimitiveMapperBinding = {
  keys: string[];
  mapper: Mapper;
};

export function bind(
  keys: string[],
  mapper: Mapper,
): PrimitiveMapperBinding {
  return { keys, mapper };
}

const DEFAULT_PRIMITIVE_MAPPER_BINDINGS: PrimitiveMapperBinding[] = [
  bind([
    'ValidationCode', 'HeadData', 'ValidationCodeHash', 'CandidateHash',
  ], (ctx, source, path) => {
    return {
      spec: spec.skip(),
      parse: {
        raw: parser.raw(),
        human: parser.raw(),
      },
    };
  }),
  bind([
    'bool',
  ], (ctx, source, path) => {
    return {
      spec: spec.bool(),
      parse: {
        raw: parser.bool(),
        human: parser.bool(),
      },
    };
  }),
  bind([
    'MultiLocation',
  ], (ctx, source, path) => {
    let real_source = source;

    if (source.info == TypeDefInfo.Si) {
      real_source = ctx.lookup.getTypeDef(source.lookupIndex!);

      if (real_source == source) {
        real_source = ctx.lookup.getTypeDef(source.type as LookupString);
      }
    }

    if (source.lookupName == 'XcmV0MultiLocation') {
      const subs = (real_source.sub! as TypeDef[]).map(item => ({ ...item }));

      const props: Record<string, spec.Spec> = {};
      const parsersRaw: Record<string, parser.Parser> = {};
      const parsersHuman: Record<string, parser.Parser> = {};

      for (const sub of subs) {
        const name = sub.name!;
        const handler = ctx.wrappers.get(ctx, sub, `${path}.${name}`);

        props[name] = handler.spec;
        parsersRaw[name] = handler.parse.raw;
        parsersHuman[name] = handler.parse.human;
      }
      return {
        spec: spec.object({ props }),
        parse: {
          raw: parser.enumObject({ propParsers: parsersRaw }),
          human: parser.junctions(),
        },
      };
    }
    else {
      const subs = (real_source.sub! as TypeDef[]).map(item => ({ ...item }));
      const props: Record<string, spec.Spec> = {};
      const parsersRaw: Record<string, parser.Parser> = {};
      const parsersHuman: Record<string, parser.Parser> = {};
      for (const sub of subs) {
        const name = sub.name!;
        const handler = ctx.wrappers.get(ctx, sub, `${path}.${name}`);

        props[name] = handler.spec;
        parsersRaw[name] = handler.parse.raw;
        parsersHuman[name] = handler.parse.human;
      }
      return {
        spec: spec.object({ props }),
        parse: {
          raw: parser.object({ propParsers: parsersRaw }),
          human: parser.object({ propParsers: parsersHuman }),
        },
      };
    }
  }),
  bind([
    'Junctions',
  ], (ctx, source, path) => {
    return {
      spec: spec.skip(),
      parse: {
        raw: parser.raw(),
        human: parser.junctions(),
      },
    };
  }),
  bind([
    'Call', 'Proposal'
  ], (ctx, source, path) => {
    return {
      spec: spec.skip(),
      parse: {
        raw: parser.raw(),
        human: parser.call(ctx, source, path),
      },
    };
  }),
  bind([
    'DispatchResult', 'Data'
  ], (ctx, source, path) => {
    return {
      spec: spec.skip(),
      parse: {
        raw: parser.raw(),
        human: parser.human(),
      },
    };
  }),
  bind([
    'Moment',
  ], (ctx, source, path) => {
    return {
      spec: spec.skip(),
      parse: {
        raw: parser.raw(),
        human: parser.moment(),
      },
    };
  }),
  bind([
    'u8', 'u16', 'u32', 'ParaId'
  ], (ctx, source, path) => {
    return {
      spec: spec.int(),
      parse: {
        raw: parser.int(),
        human: parser.int(),
      },
    };
  }),
  bind([
    'u64', 'i64', 'u128', 'i128',
  ], (ctx, source, path) => {
    return {
      spec: spec.bigint(),
      parse: {
        raw: parser.bigint(),
        human: parser.bigint(),
      },
    };
  }),
  bind([
    'UnsignedFixedPoint',
  ], (ctx, source, path) => {
    const parseUnsignedFixedPoint = parser.balance({
      parseRaw: parser.fixedPoint({ decimals: 18 }),
    });

    return {
      spec: spec.balance(),
      parse: {
        raw: parseUnsignedFixedPoint,
        human: parseUnsignedFixedPoint,
      },
    };
  }),
  bind([
    'SignedFixedPoint',
  ], (ctx, source, path) => {
    const parseSignedFixedPoint = parser.balance({
      parseRaw: parser.fixedPoint({ decimals: 18 }),
    });

    return {
      spec: spec.balance(),
      parse: {
        raw: parseSignedFixedPoint,
        human: parseSignedFixedPoint,
      },
    };
  }),
  bind([
    'Balance', 'BalanceOf', 'PalletBalanceOf', 'B'
  ], (ctx, source, path) => {
    return {
      spec: spec.balance(),
      parse: {
        raw: parser.balance(),
        human: parser.humanBalance(),
      },
    };
  }),
  bind([
    'CurrencyId', 'CurrencyIdOf'
  ], (ctx, source, path) => {
    return {
      spec: spec.currency(),
      parse: {
        raw: parser.currency(),
        human: parser.currency(),
      },
    };
  }),
  bind([
    'Bytes', 'Kind'
  ], (ctx, source, path) => {
    return {
      spec: spec.hash(),
      parse: {
        raw: parser.string(),
        human: parser.bytes(),
      },
    };
  }),
  bind([
    'H256', 'AuthorityId', 'CallHash', 'MessageId', '[u8;32]', 'Public'
  ], (ctx, source, path) => {
    return {
      spec: spec.hash(),
      parse: {
        raw: parser.string(),
        human: parser.shortHash(),
      },
    };
  }),
  /*
    Do not ever bind 'AccountId', because it can point to different types in different networks,
    like 'AccountId20' (which is evm type of address) in Moonbeam and 'AccountId32' (which is
    substrate type of address) in Polkadot
  */
  // TODO: check for MultiAddress and AccountId20 compatibility
  bind([
    'AccountId32', /* 'MultiAddress', */
  ], (ctx, source, path) => {
    return {
      spec: spec.address({ addressFormat: 'substrate', ss58Prefix: ctx.about.chain.ss58Prefix! }),
      parse: {
        raw: parser.string(),
        human: parser.account(),
      },
    };
  }),
  // TODO: check for AccountId32 compatibility
  bind([
    'MultiAddress',
  ], (ctx, source, path) => {
    return {
      spec: spec.address({ addressFormat: 'substrate', ss58Prefix: ctx.about.chain.ss58Prefix! }),
      parse: {
        raw: parser.string(),
        human: parser.account(),
      },
    };
  }),
  // TODO: check for MultiAddress compatibility
  bind([
    'AccountId20', 'H160' /* 'EthereumAddress', */
  ], (ctx, source, path) => {
    return {
      spec: spec.address({ addressFormat: 'evm' }),
      parse: {
        raw: parser.string(),
        human: parser.account(),
      },
    };
  }),
];

export function buildIndex(
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
  let mapper: Mapper | undefined = undefined;

  if (source.typeName != undefined) {
    mapper = ctx.primitives.index[source.typeName];

    if (!mapper) {
      ctx.primitives.unknowns.complex.add(source.typeName, path);
    }
  }

  if (!mapper) {
    mapper = ctx.wrappers.index[source.info];

    if (!mapper) {
      ctx.wrappers.unknowns.add(source.info, path);
    }
  }

  if (mapper) {
    return mapper(ctx, source, path);
  } else {
    return unknown(ctx, source, path);
  }
};

export const primitive: Mapper = (ctx, source, path) => {
  let mapper: Mapper | undefined = undefined;

  if (source.typeName != undefined) {
    mapper = ctx.primitives.index[source.typeName];

    if (!mapper) {
      ctx.primitives.unknowns.complex.add(source.typeName, path);
    }
  }

  if (!mapper) {
    mapper = ctx.primitives.index[source.type];

    if (!mapper) {
      ctx.primitives.unknowns.basic.add(source.type, path);
    }
  }

  if (mapper) {
    return mapper(ctx, source, path);
  } else {
    return unknown(ctx, source, path);
  }
};
