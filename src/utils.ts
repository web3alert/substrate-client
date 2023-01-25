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

export function formatBalance(raw: number, decimals: number, symbol: string): string {
  const rawBalance = (raw / Math.pow(10, decimals));

  let format = "";
  let stringBalance = rawBalance.toString()
  if (stringBalance.includes('e')) {
    stringBalance = rawBalance.toFixed(decimals)
  }
  const splited = stringBalance.split('.');
  if (splited.length == 2 && splited[1].length > 4) {
    const firstNotZero = [...splited[1]].findIndex(char => char != '0')
    if (firstNotZero < 4) {
      format = rawBalance.toFixed(4);
    }
    else if (firstNotZero > decimals - 4) {
      format = rawBalance.toFixed(decimals)
    }
    else format = rawBalance.toFixed(firstNotZero + 1)
  } else {
    format = rawBalance.toString();
  }

  let result = format + ' ' + symbol;

  return result;
}
