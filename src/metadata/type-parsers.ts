import _, { range } from 'lodash';
import type {
  Int,
  BTreeMap,
  Struct,
  Enum,
  Vec,
  Tuple,
  Option,
  GenericCall
} from '@polkadot/types';
import type { Codec, TypeDef } from '@polkadot/types/types';
import type { LookupString } from '@polkadot/types-codec/types';
import type {
  Json,
  Object,
  CurrencyInfo,
} from '../types';
import type { CurrencyRegistry } from './currency-registry';
import type * as spec from './type-specs';
import type { Junction, JunctionV0 } from '@polkadot/types/interfaces';
import type { Context } from './type-mappers';
import type { ApiPromise } from '@polkadot/api';
import { formatBalance } from '../utils';

type Lookup = { match: string; replace: string };

export type ParserContext = {
  api: ApiPromise;
  currencies: CurrencyRegistry;
  path: string[];
  spec: spec.Spec;
  rawArgs: Object;
};

export type Parser<T extends Json = Json> = (value: Codec, ctx: ParserContext) => Promise<T>;

export function isPlainCurrency(currency: spec.BalanceCurrency): currency is spec.BalancyCurrencyPlain {
  return 'plain' in currency;
};
export function isIndexCurrency(currency: spec.BalanceCurrency): currency is spec.BalancyCurrencyIndex {
  return 'index' in currency;
};


function getLookupSymbol(ctx: ParserContext, lookup?: Lookup): string | undefined {
  if (!lookup) {
    return undefined;
  }

  const lookupPath = ctx.path
    .join('.')
    .replace(new RegExp(lookup.match), lookup.replace)
    .split('.')
    ;

  const currencyArgValue = _.get(ctx.rawArgs, lookupPath);
  const currencyArgValueParsed = parseCurrency(currencyArgValue);

  if (typeof currencyArgValueParsed == 'string') {
    return currencyArgValueParsed;
  }

  return undefined;
}

// 🌈​🦄​🦋​✨🥰
function getCurrencyInfo(ctx: ParserContext, spec: spec.Balance): CurrencyInfo | undefined {
  if (!spec.currency) {
    return undefined;
  }

  if (isPlainCurrency(spec.currency)) {
    const symbol = spec.currency.plain;

    return ctx.currencies.get(symbol);
  } else if(isIndexCurrency(spec.currency)){
    return undefined;
  } else {
    const symbol = getLookupSymbol(ctx, spec.currency.lookup);
    const symbol2 = getLookupSymbol(ctx, spec.currency.lookup2);

    if ((symbol && symbol2 && symbol2 == symbol) || (symbol && !symbol2)) {
      return ctx.currencies.get(symbol);
    }
  }

  return undefined;
}

export function parseCurrency(raw: Json): Json {
  if (typeof raw == 'object' && raw != null) {
    const tryPaths = [
      'token',
      'vToken',
      'stable',
      'vsToken',
      //'vsBond.0',
    ];

    for (const tryPath of tryPaths) {
      const value = _.get(raw, tryPath);

      if (typeof value == 'string') {
        return value;
      }
    }
  }

  return raw;
}

export function raw(): Parser<Json> {
  return async value => value.toJSON();
}

export function human(): Parser<Json> {
  return async value => value.toHuman();
}

export function unknownRaw(mainContext: Context, source: TypeDef, path: string): Parser<Json> {
  var expandSource = source
  if (source.type.includes('Lookup') && source.lookupIndex) {
    expandSource = mainContext.lookup.getTypeDef(source.lookupIndex)
  }
  return async (value, ctx) => {
    if (expandSource.type === 'Null') {
      return null
    }
    let handler = mainContext.wrappers.get(mainContext, expandSource, path)
    if (handler.spec.type == 'unknown') {
      //console.log(`Warning: Type ${expandSource.type} has no parser.`)
      return value.toJSON()
    }
    return handler.parse.raw(value, {
      api: ctx.api,
      currencies: ctx.currencies,
      path: ctx.path,
      spec: handler.spec,
      rawArgs: ctx.rawArgs,
    })
  }
}

export function unknownHuman(mainContext: Context, source: TypeDef, path: string): Parser<Json> {
  var expandSource = source
  if (source.type.includes('Lookup') && source.lookupIndex) {
    expandSource = mainContext.lookup.getTypeDef(source.lookupIndex)
  }
  return async (value, ctx) => {
    if (expandSource.type === 'Null') {
      return null
    }
    let handler = mainContext.wrappers.get(mainContext, expandSource, path)
    if (handler.spec.type == 'unknown') {
      //console.log(`Warning: Type ${expandSource.type} has no parser.`)
      return value.toHuman()
    }
    return handler.parse.human(value, {
      api: ctx.api,
      currencies: ctx.currencies,
      path: ctx.path,
      spec: handler.spec,
      rawArgs: ctx.rawArgs,
    })
  }
}

export function call(mainContext: Context, source: TypeDef, path: string): Parser<Json> {
  return async (value, ctx) => {
    const callValue = value as GenericCall
    const module = callValue.section
    const method = callValue.method
    const args: Json = {}
    for (let i = 0; i < callValue.args.length; i++) {
      const argEntry = callValue.argsEntries[i]
      const argName = argEntry[0];
      const argType = callValue.argsDef[argName].toString() as LookupString;
      const argSource = mainContext.lookup.getTypeDef(argType)
      const handler = mainContext.wrappers.get(mainContext, argSource, `${path}.${argName}`);
      args[argName] = await handler.parse.human(argEntry[1], {
        api: ctx.api,
        currencies: ctx.currencies,
        path: [...ctx.path, argName],
        rawArgs: ctx.rawArgs,
        spec: handler.spec
      });
    }
    return {
      module,
      method,
      args
    }
  }
}

export function bool(): Parser<boolean> {
  return async value => value.toJSON() as boolean;
}

export function int(): Parser<number> {
  return async value => value.toJSON() as number;
}

export function bigint(): Parser<number> {
  return async value => Number((value as Int).toBigInt());
}

function makeHashShorter(hash: string): string {
  if (hash.length > 12) {
    return hash.substring(0, 7) + '...' + hash.substring(hash.length - 5, hash.length)
  }
  else return hash;
}

export function shortHash(): Parser<Json> {
  return async value => {
    let hash = value.toString() as string;
    return makeHashShorter(hash)
  }
}

export function bytes(): Parser<Json> {
  return async value => {
    let result = value.toHuman()?.toString()
    if (result && result.startsWith('0x')) {
      return makeHashShorter(result)
    }
    return result;
  }
}

export function moment(): Parser<Json> {
  return async value => {
    var date = new Date(Number(value))
    let formattedDate =
      date.getFullYear() +
      "-" +
      (date.getMonth() + 1) +
      "-" +
      date.getDate() +
      " " +
      date.getHours() +
      ":" +
      date.getMinutes() +
      ":" +
      date.getSeconds()
    return formattedDate + " (UTC+0)"
  }
}

export function account(): Parser<Json> {
  return async (value, ctx) => {
    const accountInfo = await ctx.api.derive.accounts.info(value.toString())
    let resultName = "";
    if (accountInfo.identity.displayParent || accountInfo.identity.display) {
      if (accountInfo.identity.displayParent) {
        resultName += accountInfo.identity.displayParent + ":"
      }
      if (accountInfo.identity.display) {
        resultName += accountInfo.identity.display
      }
    } else if (accountInfo.accountIndex) {
      resultName = accountInfo.accountIndex.toString()
    }
    else resultName = value.toString()
    return resultName;
  }
}

export type FixedPointOptions = {
  decimals: number;
};

export function fixedPoint(options: FixedPointOptions): Parser<number> {
  const {
    decimals,
  } = options;

  return async value => {
    const raw = Number((value as Int).toBigInt());

    return raw / Math.pow(10, decimals);
  }
}

export function junctions(): Parser<Json> {
  return async value => {
    const raw = value as any
    const index = checkJunctionIndex(raw)
    let result: Json = {}
    if (index == 0) {
      result = value.toHuman()
    }
    else if (index == 1) {
      result = parseJunction(raw[`asX${index}`])
    }
    else {
      const tupleOfJunctions = raw[`asX${index}`]
      result = []
      for (let i = 0; i < index; i++) {
        result.push(parseJunction(raw[`asX${index}`][i]))
      }
    }
    return result
  }
}

function checkJunctionIndex(junctions: any): number {
  return range(1, 8).find(index => junctions[`isX${index}`]) ?? 0
}

function parseJunction(junction: Junction | JunctionV0): Json {
  if (junction.isAccountId32) {
    let hash = junction.asAccountId32.id.toString() as string;
    let short = hash.substring(0, 7) + '...' + hash.substring(hash.length - 5, hash.length)
    const result = {
      network: junction.asAccountId32.network.toHuman(),
      id: short
    }
    return result
  } else if (junction.isAccountIndex64) {
    return junction.asAccountIndex64.toHuman()
  } else if (junction.isAccountKey20) {
    let hash = junction.asAccountKey20.key.toString() as string;
    let short = hash.substring(0, 7) + '...' + hash.substring(hash.length - 5, hash.length)
    const result = {
      id: short,
      network: junction.asAccountKey20.network.toHuman()
    }
    return result
  } else if (junction.isGeneralIndex) {
    return {
      generalIndex: junction.asGeneralIndex.toJSON()
    }
  } else if (junction.isGeneralKey) {
    return {
      generalKey: junction.asGeneralKey.toHuman()
    }
  } else if (junction.isPalletInstance) {
    return {
      palletInstance: junction.asPalletInstance.toJSON()
    }
  } else if (junction.isParachain) {
    return {
      parachain: junction.asParachain.toJSON()
    }
  } else if (junction.isPlurality) {
    return {
      plurality: junction.asPlurality.toHuman()
    }
  }
  return junction.toHuman()
}

export type BalanceOptions = {
  parseRaw?: Parser<number>;
};

export function balance(options?: BalanceOptions): Parser<number> {
  const parseRaw: Parser<number> = options?.parseRaw || raw() as Parser<number>;

  return async (value, ctx) => {
    const specAsBalance = ctx.spec as spec.Balance;
    const raw = Number(await parseRaw(value, ctx));

    const currencyInfo = getCurrencyInfo(ctx, specAsBalance);
    if (currencyInfo) {
      return raw / Math.pow(10, currencyInfo.decimals);
    }

    return raw;
  };
}

export function humanBalance(options?: BalanceOptions): Parser<Json> {
  const parseRaw: Parser<number> = options?.parseRaw || raw() as Parser<number>;

  return async (value, ctx) => {
    const specAsBalance = ctx.spec as spec.Balance;
    const raw = Number(await parseRaw(value, ctx));

    const currencyInfo = getCurrencyInfo(ctx, specAsBalance);
    if (currencyInfo) {
      return formatBalance(raw, currencyInfo.decimals, currencyInfo.symbol);
    }

    return raw;
  };
}

export function string(): Parser<string> {
  return async value => value.toString() as string;
}

export type MapOptions = {
  keysParser: Parser<string | number>;
  valuesParser: Parser;
};

export function map(options: MapOptions): Parser<Record<string | number, Json>> {
  const {
    keysParser,
    valuesParser,
  } = options;

  return async (value, ctx) => {
    const specAsMap = ctx.spec as spec.Map;
    const asMap = value as BTreeMap;

    const result: Record<string | number, Json> = {};
    for (const [key, value] of asMap.entries()) {
      const keyDecoded = await keysParser(key, {
        api: ctx.api,
        currencies: ctx.currencies,
        path: ctx.path,
        spec: specAsMap.keys,
        rawArgs: ctx.rawArgs,
      });

      result[keyDecoded] = await valuesParser(value, {
        api: ctx.api,
        currencies: ctx.currencies,
        path: [...ctx.path, '' + keyDecoded],
        spec: specAsMap.values,
        rawArgs: ctx.rawArgs,
      });
    }

    return result;
  };
}

export type ObjectOptions = {
  propParsers: Record<string, Parser>;
};

export function object(options: ObjectOptions): Parser<Record<string, Json>> {
  const {
    propParsers,
  } = options;

  const keys = Object.keys(propParsers);

  return async (value, ctx) => {
    const specAsObject = ctx.spec as spec.Object;
    const asStruct = value as Struct;
    const result: Object = {};
    for (const key of keys) {
      result[key] = await propParsers[key](asStruct.get(key)!, {
        api: ctx.api,
        currencies: ctx.currencies,
        path: [...ctx.path, key],
        spec: specAsObject.props[key],
        rawArgs: ctx.rawArgs,
      });
    }

    return result;
  };
}

export type EnumObjectOptions = {
  propParsers: Record<string, Parser>;
};

export function enumObject(options: EnumObjectOptions): Parser<Object> {
  const {
    propParsers,
  } = options;

  return async (value, ctx) => {
    const specAsObject = ctx.spec as spec.Object;
    const asEnum = value as Enum;

    const result: Object = {};
    const key = asEnum.type;
    result[key] = await propParsers[key](asEnum.value, {
      api: ctx.api,
      currencies: ctx.currencies,
      path: [...ctx.path, key],
      spec: specAsObject.props[key],
      rawArgs: ctx.rawArgs,
    });

    return result;
  };
}

export function humanEnumObject(options: EnumObjectOptions): Parser<Json> {
  const {
    propParsers,
  } = options;

  return async (value, ctx) => {
    const specAsObject = ctx.spec as spec.Object;
    const asEnum = value as Enum;

    const result: Object = {};
    const key = asEnum.type;
    result[key] = await propParsers[key](asEnum.value, {
      api: ctx.api,
      currencies: ctx.currencies,
      path: [...ctx.path, key],
      spec: specAsObject.props[key],
      rawArgs: ctx.rawArgs,
    });
    if (result[key] === null) {
      return key
    }
    else {
      return result
    }
  };
}

export type ArrayOptions<T extends Json> = {
  parseItem: Parser<T>;
};

export function array<T extends Json = Json>(options: ArrayOptions<T>): Parser<T[]> {
  const {
    parseItem,
  } = options;

  return async (value, ctx) => {
    const specAsArray = ctx.spec as spec.Array;
    const asArray = value as Vec<Codec>;

    return await Promise.all(asArray.map(async (item, index) => {
      return parseItem(item, {
        api: ctx.api,
        currencies: ctx.currencies,
        path: [...ctx.path, '' + index],
        spec: specAsArray.items,
        rawArgs: ctx.rawArgs,
      });
    }));
  };
}

export function humanArray<T extends Json = Json>(options: ArrayOptions<T>): Parser<Json> {
  const {
    parseItem,
  } = options;

  return async (value, ctx) => {
    const specAsArray = ctx.spec as spec.Array;
    const asArray = value as Vec<Codec>;

    const vec = await Promise.all(asArray.map(async (item, index) => {
      return await parseItem(item, {
        api: ctx.api,
        currencies: ctx.currencies,
        path: [...ctx.path, '' + index],
        spec: specAsArray.items,
        rawArgs: ctx.rawArgs,
      });
    }));

    if (vec.length > 10) {
      let result: Json[] = []
      vec.forEach((item, index) => {
        if (index < 10) result.push(item)
        else if (index == 10) result.push(`too many elements. length = ${vec.length}`)
      })
      return result
    }
    else return vec
  };
}

export function option<T extends Json = Json>(options: ArrayOptions<T>): Parser<T | null> {
  const {
    parseItem,
  } = options;

  return async (value, ctx) => {
    const raw = value as Option<Codec>
    if (raw.value.isEmpty) {
      return null
    }
    else return await parseItem(raw.value, ctx)
  };
}

export type TupleOptions = {
  itemParsers: Parser[];
};

export function tuple(options: TupleOptions): Parser<Json[]> {
  const {
    itemParsers,
  } = options;

  return async (value, ctx) => {
    const specAsTuple = ctx.spec as spec.Tuple;
    const asTuple = value as Tuple;

    return await Promise.all(asTuple.map(async (item, index) => {
      const parseItem = itemParsers[index];

      return await parseItem(item, {
        api: ctx.api,
        currencies: ctx.currencies,
        path: [...ctx.path, '' + index],
        spec: specAsTuple.items[index],
        rawArgs: ctx.rawArgs,
      });
    }));
  };
}