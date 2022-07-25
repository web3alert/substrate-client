import type { Codec } from '@polkadot/types/types';
import type {
  EventName,
  Event,
} from './types';
import type {
  spec,
  parser,
  Metadata,
} from './metadata';
import { error } from './error';

function isPlainCurrency(currency: spec.BalanceCurrency): currency is spec.BalancyCurrencyPlain {
  return 'plain' in currency;
};

export interface HandleEventOptions {
  metadata: Metadata;
  blockNumber: number;
  index: number | null;
  event: {
    name: EventName;
    argValues: Codec[];
    argTypes: number[];
  };
}

export function handleEvent(options: HandleEventOptions): Event {
  const {
    metadata,
    blockNumber,
    index,
    event,
  } = options;
  
  const eventSpec = metadata.get(event.name.full);
  
  if (!eventSpec) {
    throw error('unknown event', {
      event: event.name.full,
    });
  }
  
  if (event.argValues.length != eventSpec.args.length) {
    throw error('event args count does not match its metadata', {
      event: event.name.full,
      expected: eventSpec.args.length,
      received: event.argValues.length,
    });
  }
  
  const params: Record<string, unknown> = {};
  
  for (let i = 0; i < event.argValues.length; i++) {
    const argValue = event.argValues[i];
    const argSpec = eventSpec.args[i];
    
    const ctx: parser.ParserContext = {};
    
    if (argSpec.spec.type == 'balance') {
      const asBalance = (argSpec.spec as spec.Balance);
      
      if (asBalance.currency) {
        if (isPlainCurrency(asBalance.currency)) {
          ctx.currency = metadata.currencies.get(asBalance.currency.plain);
        } else {
          // TODO: implement more complex lookup for cases where lookup path could be nested
          const lookup = asBalance.currency.lookup;
          const currencyArgIndex = eventSpec.args.findIndex(item => item.name == lookup);
          const currencyArgValue = event.argValues[currencyArgIndex];
          const currencyArgParser = eventSpec.args[currencyArgIndex].parse;
          const currencyArgValueDecoded = currencyArgParser(currencyArgValue) as any;
          
          // 🌈​🦄​🦋​✨🥰
          if (currencyArgValueDecoded['token']) {
            const symbol = currencyArgValueDecoded['token'];
            
            if (typeof symbol == 'string') {
              ctx.currency = metadata.currencies.get(symbol);
            }
          }
        }
      }
    }
    
    params[argSpec.name] = argSpec.parse(argValue, ctx);
  }
  
  return {
    name: event.name.full,
    params,
    payload: {
      block: blockNumber,
      index,
    },
  };
}
