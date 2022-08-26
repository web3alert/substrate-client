import _ from 'lodash';
import type {
  Int,
  BTreeMap,
  Struct,
  Enum,
  Vec,
  Tuple,
} from '@polkadot/types';
import type { Codec } from '@polkadot/types/types';
import type {
  Json,
  Object,
  CurrencyInfo,
} from '../types';
import type { CurrencyRegistry } from './currency-registry';
import type * as spec from './type-specs';

export type ParserContext = {
  currencies: CurrencyRegistry;
  path: string[];
  spec: spec.Spec;
  rawArgs: Object;
};

export type Parser<T extends Json = Json> = (value: Codec, ctx: ParserContext) => T;

function isPlainCurrency(currency: spec.BalanceCurrency): currency is spec.BalancyCurrencyPlain {
  return 'plain' in currency;
};

export function raw(): Parser<Json> {
  return value => value.toJSON();
}

export function human(): Parser<Json> {
  return value => value.toHuman();
}

export function bool(): Parser<boolean> {
  return value => value.toJSON() as boolean;
}

export function int(): Parser<number> {
  return value => value.toJSON() as number;
}

export function bigint(): Parser<number> {
  return value => Number((value as Int).toBigInt());
}

export function shortHash(): Parser<Json> {
  return value => {
    let hash = value.toString() as string;
    let short = hash.substring(0, 7) + '...' + hash.substring(hash.length - 5, hash.length)
    return short
  }
}

export function bytes(): Parser<Json> {
  return value => {
    const raw = value.toString() as string
    let hex: string;
    let decoded: string = ""
    let char: string = ""

    if (raw.startsWith("0x")) {
      hex = raw.slice(2)
    }
    else hex = raw

    for (var i = 0; i < hex.length; i += 2) {
      char += "%" + hex.substring(i, i + 2)
      try {
        decoded += decodeURIComponent(char)
        char = ""
      } catch {
        continue
      }
    }

    if (decoded === "") {
      return value.toString().length > 40
        ? raw.substring(0, 7) + '...' + raw.substring(raw.length - 5, raw.length)
        : raw
    } else return decoded
  }
}

export function moment(): Parser<Json> {
  return value => {
    var date = new Date(Number(value))
    let formatted_date =
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
    return formatted_date + " (UTC+0)"
  }
}

export type FixedPointOptions = {
  decimals: number;
};

export function fixedPoint(options: FixedPointOptions): Parser<number> {
  const {
    decimals,
  } = options;

  return value => {
    const raw = Number((value as Int).toBigInt());

    return raw / Math.pow(10, decimals);
  }
}

export type BalanceOptions = {
  parseRaw?: Parser<number>;
};

export function balance(options?: BalanceOptions): Parser<number> {
  const parseRaw: Parser<number> = options?.parseRaw || raw() as Parser<number>;

  return (value, ctx) => {
    const specAsBalance = ctx.spec as spec.Balance;
    const raw = parseRaw(value, ctx);

    if (specAsBalance.currency) {
      let currency: CurrencyInfo | undefined = undefined;

      if (isPlainCurrency(specAsBalance.currency)) {
        const symbol = specAsBalance.currency.plain;

        currency = ctx.currencies.get(symbol);
      } else {
        const lookup = specAsBalance.currency.lookup;
        const lookupPath = ctx.path
          .join('.')
          .replace(new RegExp(lookup.match), lookup.replace)
          .split('.')
          ;

        const currencyArgValueDecoded = _.get(ctx.rawArgs, lookupPath);

        // 🌈​🦄​🦋​✨🥰
        if (typeof currencyArgValueDecoded == 'object' && currencyArgValueDecoded['token']) {
          const symbol = currencyArgValueDecoded['token'];

          if (typeof symbol == 'string') {
            currency = ctx.currencies.get(symbol);
          }
        }
      }

      if (currency) {
        return raw / Math.pow(10, currency.decimals);
      }
    }

    return raw;
  };
}

export function humanBalance(options?: BalanceOptions): Parser<Json> {
  const parseRaw: Parser<number> = options?.parseRaw || raw() as Parser<number>;

  return (value, ctx) => {
    const specAsBalance = ctx.spec as spec.Balance;
    const raw = parseRaw(value, ctx);

    if (specAsBalance.currency) {
      let currency: CurrencyInfo | undefined = undefined;

      if (isPlainCurrency(specAsBalance.currency)) {
        const symbol = specAsBalance.currency.plain;

        currency = ctx.currencies.get(symbol);
      } else {
        const lookup = specAsBalance.currency.lookup;
        const lookupPath = ctx.path
          .join('.')
          .replace(new RegExp(lookup.match), lookup.replace)
          .split('.')
          ;

        const currencyArgValueDecoded = _.get(ctx.rawArgs, lookupPath);

        // 🌈​🦄​🦋​✨🥰
        if (typeof currencyArgValueDecoded == 'object' && currencyArgValueDecoded['token']) {
          const symbol = currencyArgValueDecoded['token'];

          if (typeof symbol == 'string') {
            currency = ctx.currencies.get(symbol);
          }
        }
      }
      if (currency) {
        let result = (raw / Math.pow(10, currency.decimals)).toFixed(4) + ' ' + currency.symbol;
        return result
      }
    }
    return raw;
  };
}

export function string(): Parser<string> {
  return value => value.toString() as string;
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

  return (value, ctx) => {
    const specAsMap = ctx.spec as spec.Map;
    const asMap = value as BTreeMap;

    const result: Record<string | number, Json> = {};
    for (const [key, value] of asMap.entries()) {
      const keyDecoded = keysParser(key, {
        currencies: ctx.currencies,
        path: ctx.path,
        spec: specAsMap.keys,
        rawArgs: ctx.rawArgs,
      });

      result[keyDecoded] = valuesParser(value, {
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

  return (value, ctx) => {
    const specAsObject = ctx.spec as spec.Object;
    const asStruct = value as Struct;
    const result: Object = {};
    for (const key of keys) {
      result[key] = propParsers[key](asStruct.get(key)!, {
        currencies: ctx.currencies,
        path: [...ctx.path, key],
        spec: specAsObject.props[key],
        rawArgs: ctx.rawArgs,
      });
    }

    return result;
  };
}

export function humanObject(options: ObjectOptions): Parser<string> {
  const {
    propParsers,
  } = options;

  const keys = Object.keys(propParsers);

  return (value, ctx) => {
    const specAsObject = ctx.spec as spec.Object;
    const asStruct = value as Struct;

    const result: Object = {};
    for (const key of keys) {
      result[key] = propParsers[key](asStruct.get(key)!, {
        currencies: ctx.currencies,
        path: [...ctx.path, key],
        spec: specAsObject.props[key],
        rawArgs: ctx.rawArgs,
      });
    }
    console.log(result)
    return JSON.stringify(result)
  };
}

export type EnumObjectOptions = {
  propParsers: Record<string, Parser>;
};

export function enumObject(options: EnumObjectOptions): Parser<Object> {
  const {
    propParsers,
  } = options;

  return (value, ctx) => {
    const specAsObject = ctx.spec as spec.Object;
    const asEnum = value as Enum;

    const result: Object = {};
    const key = asEnum.type;
    result[key] = propParsers[key](asEnum.value, {
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

  return (value, ctx) => {
    const specAsObject = ctx.spec as spec.Object;
    const asEnum = value as Enum;

    const result: Object = {};
    const key = asEnum.type;
    result[key] = propParsers[key](asEnum.value, {
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

  return (value, ctx) => {
    const specAsArray = ctx.spec as spec.Array;
    const asArray = value as Vec<Codec>;

    return asArray.map((item, index) => {
      return parseItem(item, {
        currencies: ctx.currencies,
        path: [...ctx.path, '' + index],
        spec: specAsArray.items,
        rawArgs: ctx.rawArgs,
      });
    });
  };
}

export function humanArray<T extends Json = Json>(options: ArrayOptions<T>): Parser<Json> {
  const {
    parseItem,
  } = options;

  return (value, ctx) => {
    const specAsArray = ctx.spec as spec.Array;
    const asArray = value as Vec<Codec>;

    const vec = asArray.map((item, index) => {
      return parseItem(item, {
        currencies: ctx.currencies,
        path: [...ctx.path, '' + index],
        spec: specAsArray.items,
        rawArgs: ctx.rawArgs,
      });
    });

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

export type TupleOptions = {
  itemParsers: Parser[];
};

export function tuple(options: TupleOptions): Parser<Json[]> {
  const {
    itemParsers,
  } = options;

  return (value, ctx) => {
    const specAsTuple = ctx.spec as spec.Tuple;
    const asTuple = value as Tuple;

    return asTuple.map((item, index) => {
      const parseItem = itemParsers[index];

      return parseItem(item, {
        currencies: ctx.currencies,
        path: [...ctx.path, '' + index],
        spec: specAsTuple.items[index],
        rawArgs: ctx.rawArgs,
      });
    });
  };
}