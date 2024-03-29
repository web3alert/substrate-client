import type { Vec } from '@polkadot/types';
import type {
  AnyTuple,
  CallBase,
  Codec,
  Registry,
} from '@polkadot/types/types';
import type {
  Block,
  Call,
  OpaqueCall,
  AccountId,
} from '@polkadot/types/interfaces';
import type {
  EventName,
  Event,
} from './types';
import type { Filter } from './filter';
import type { EventRecord } from './event-record';
import type { Metadata } from './metadata';
import { handleEvent } from './handle-event';
import {
  Result,
  buildEventName,
} from './utils';
import {
  isErrorDetails,
  error,
} from './error';
import type { ApiPromise } from '@polkadot/api';

type CallWrapper = {
  name: EventName;
  source: CallBase<AnyTuple>;
  signer?: string;
};

const BATCH_CALLS: string[] = [
  'utility.batch',
  'utility.batch-all',
  'utility.force-batch'
];

const MULTISIG_AS_MULTI_CALL: string = 'multisig.as-multi';

const PROXY_CALLS: string[] = [
  'proxy.proxy',
  'proxy.proxy-announced',
];

const WRAPPER_CALLS: string[] = [
  ...PROXY_CALLS,
  'utility.as-derivative',
  'multisig.as-multi-threshold-1',
  MULTISIG_AS_MULTI_CALL,
];

function extrinsicSucceeded(eventRecords: EventRecord[], extrinsicIndex: number): boolean {
  let successEventFound = 0;
  let failedEventFound = 0;
  
  for (const eventRecord of eventRecords) {
    const { event, index } = eventRecord;
    
    if (index != null && index == extrinsicIndex) {
      const eventName = buildEventName({
        kind: 'event',
        module: event.section,
        event: event.method,
      });
      
      if (eventName.short == 'system.extrinsic-success') {
        successEventFound++;
      } else if (eventName.short == 'system.extrinsic-failed') {
        failedEventFound++;
      }
    }
  }
  
  if (successEventFound + failedEventFound != 1) {
    throw error('integrity violation when checking extrinsic against success-failed events', {
      extrinsicIndex,
      successEventFound,
      failedEventFound,
    });
  }
  
  return (successEventFound == 1);
}

function isInterrupted(eventRecords: EventRecord[], extrinsicIndex: number): boolean {
  let interruptedEventFound = 0;
  
  for (const eventRecord of eventRecords) {
    const { event, index } = eventRecord;
    
    if (index != null && index == extrinsicIndex) {
      const eventName = buildEventName({
        kind: 'event',
        module: event.section,
        event: event.method,
      });
      
      if (eventName.short == 'utility.batch-interrupted' ||
      eventName.short == 'utility.batch-completed-with-errors' ||
      eventName.short == 'utility.item-failed') {
        interruptedEventFound++;
      }
    }
  }
  
  return (interruptedEventFound > 0);
}

function castCallArgByName<T extends Codec>(
  call: CallWrapper,
  argName: string,
  argTypes: string[],
): T {
  const index = call.source.meta.args.findIndex(item => item.name.toString() == argName);
  
  if (index == -1) {
    throw error('argument not found in call', {
      call: call.name.short,
      arg: argName,
    });
  }
  
  const argTypeMetadata = call.source.meta.args[index].type.toString();
  
  if (!argTypes.includes(argTypeMetadata)) {
    throw error('argument type is not as expected', {
      call: call.name.short,
      arg: argName,
      expected: argTypes.join(' | '),
      received: argTypeMetadata,
    });
  }
  
  return call.source.args[index] as T;
}

interface HandleCallOptions {
  api: ApiPromise,
  filter: Filter;
  metadata: Metadata;
  registry: Registry;
  blockNumber: number;
  index: number;
  call: CallWrapper;
}

async function handleCall(options: HandleCallOptions): Promise<Result<Event>> {
  const {
    api,
    filter,
    metadata,
    registry,
    blockNumber,
    index,
    call,
  } = options;
  
  const result = new Result<Event>();
  
  try {
    if (BATCH_CALLS.includes(call.name.short)) {
      const batchedCalls = castCallArgByName<Vec<Call>>(call, 'calls', ['Vec<Call>']);
      
      for (const batchedCall of batchedCalls) {
        result.merge(await handleCall({
          api,
          filter,
          metadata,
          registry,
          blockNumber,
          index,
          call: {
            name: buildEventName({
              kind: 'call',
              module: batchedCall.section,
              event: batchedCall.method,
            }),
            source: batchedCall,
            signer: call.signer,
          },
        }));
      }
    } else if (WRAPPER_CALLS.includes(call.name.short)) {
      let wrappedCall: Call;
      
      if (call.name.short == MULTISIG_AS_MULTI_CALL) {
        const wrappedOpaqueCall = castCallArgByName<OpaqueCall>(call, 'call', ['OpaqueCall<T>','WrapperKeepOpaque<Call>']);
        
        wrappedCall = registry.createType('Call', wrappedOpaqueCall.toHex());
      } else {
        wrappedCall = castCallArgByName<Call>(call, 'call', ['Call']);
      }
      
      let signer = call.signer;
      
      if (PROXY_CALLS.includes(call.name.short)) {
        const realSigner = castCallArgByName<AccountId>(call, 'real', ['AccountId20', 'AccountId32', 'MultiAddress']);
        
        signer = realSigner.toString();
      }
      
      result.merge(await handleCall({
        api,
        filter,
        metadata,
        registry,
        blockNumber,
        index,
        call: {
          name: buildEventName({
            kind: 'call',
            module: wrappedCall.section,
            event: wrappedCall.method,
          }),
          source: wrappedCall,
          signer,
        },
      }));
    } else if (filter.match(call.name.full)) {
      const event = await handleEvent({
        api,
        metadata,
        blockNumber,
        index,
        event: {
          name: call.name,
          argValues: call.source.args,
          argTypes: call.source.meta.fields.map(field => field.type.toNumber()),
        },
      });
      
      if (call.signer != undefined) {
        if (event.params.raw['signer'] != undefined) {
          throw error('call already has signer arg', {
            event: event.name,
            fromArgs: event.params.raw['signer'],
            fromHandling: call.signer,
          });
        }
        
        event.params.raw['signer'] = call.signer;
        event.params.human['signer'] = call.signer;
      }
      
      result.items.push(event);
    }
  } catch (err) {
    if (isErrorDetails(err)) {
      result.errors.push({
        message: err.message,
        details: err.details,
      });
    } else {
      throw error('unknown error', {
        err,
      });
    }
  }
  
  return result;
}

export type HandleCallsOptions = {
  api: ApiPromise,
  filter: Filter;
  metadata: Metadata;
  registry: Registry;
  block: Block;
  eventRecords: EventRecord[];
};

export async function handleCalls(options: HandleCallsOptions): Promise<Result<Event>> {
  const {
    api,
    filter,
    metadata,
    registry,
    block,
    eventRecords,
  } = options;
  
  const result = new Result<Event>();
  
  for (let i = 0; i < block.extrinsics.length; i++) {
    const extrinsic = block.extrinsics[i];
    
    try {
      if (extrinsicSucceeded(eventRecords, i) && !isInterrupted(eventRecords, i)) {
        result.merge(await handleCall({
          api,
          filter,
          metadata,
          registry,
          blockNumber: block.header.number.toNumber(),
          index: i,
          call: {
            name: buildEventName({
              kind: 'call',
              module: extrinsic.method.section,
              event: extrinsic.method.method,
            }),
            source: extrinsic.method,
            signer: (extrinsic.isSigned) ? extrinsic.signer.toString() : undefined,
          },
        }));
      }
    } catch (err: any) {
      if (isErrorDetails(err)) {
        result.errors.push({
          message: err.message,
          details: err.details,
        });
      } else {
        throw error('unknown error', {
          err,
        });
      }
    }
  }
  
  return result;
}
