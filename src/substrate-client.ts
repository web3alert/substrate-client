import type { BlockHash } from '@polkadot/types/interfaces';
import type { RegistryTypes } from '@polkadot/types/types';
import {
  WsProvider,
  ApiPromise,
} from '@polkadot/api';
import type { ApiDecoration } from '@polkadot/api/types';
import type {
  AddressFormat,
  About,
  Event,
} from './types';
import type { EventRecord } from './event-record';
import { Result } from './utils';
import { Metadata } from './metadata';
import { Filter } from './filter';
import { handleEvents } from './handle-events';
import { handleCalls } from './handle-calls';

export type ApiAt = ApiDecoration<'promise'>;

export type BlockPointer = {
  blockNumber: number;
  blockHash: BlockHash;
  apiAt: ApiAt;
  runtimeVersion: number;
};

export type SubstrateClientConnectOptions = {
  types?: RegistryTypes;
};

export type SubstrateClientOptions = {
  defaultAddressFormat?: AddressFormat;
  filter?: {
    patterns: string[];
  };
};

export class SubstrateClient {
  public defaultAddressFormat: AddressFormat;
  public api!: ApiPromise;
  public filter: Filter;
  public metadata!: Metadata;
  
  constructor(options?: SubstrateClientOptions) {
    this.defaultAddressFormat = options?.defaultAddressFormat ?? 'substrate';
    this.filter = new Filter({
      patterns: options?.filter?.patterns ?? [],
    });
  }
  
  public async connect(wsUrl: string, options?: SubstrateClientConnectOptions): Promise<void> {
    this.api = await ApiPromise.create({
      provider: new WsProvider(wsUrl),
      types: options?.types,
    });
    
    try {
      const currentBlockNumber = await this.currentBlockNumber();
      const pointer = await this.blockPointer(currentBlockNumber);
      
      await this.updateCurrentMetadata(pointer);
    } catch (err) {
      await this.api.disconnect();
      
      throw err;
    }
  }
  
  public async close(): Promise<void> {
    await this.api.disconnect();
  }
  
  public async currentBlockNumber(): Promise<number> {
    const blockHash = await this.api.rpc.chain.getFinalizedHead();
    const blockHeader = await this.api.rpc.chain.getHeader(blockHash);
    
    return blockHeader.number.toNumber();
  }
  
  public async blockPointer(blockNumber: number): Promise<BlockPointer> {
    const blockHash = await this.api.rpc.chain.getBlockHash(blockNumber);
    const apiAt = await this.api.at(blockHash);
    const runtimeVersion = apiAt.consts.system.version.specVersion.toNumber();
    
    return {
      blockNumber,
      blockHash,
      apiAt,
      runtimeVersion,
    };
  }
  
  public async about(pointer: BlockPointer): Promise<About> {
    const nodeName = await this.api.rpc.system.name();
    const nodeVersion = await this.api.rpc.system.version();
    
    const runtimeVersion = pointer.apiAt.consts.system.version;
    const chainProperties = pointer.apiAt.registry.getChainProperties();
    
    if (!chainProperties) {
      throw new Error('cannot retrive chain properties');
    }
    
    const about: About = {
      node: {
        name: nodeName.toString(),
        version: nodeVersion.toString(),
      },
      block: {
        number: pointer.blockNumber,
        hash: pointer.blockHash.toHex(),
      },
      chain: {
        name: runtimeVersion.specName.toString(),
        version: runtimeVersion.specVersion.toNumber(),
        defaultAddressFormat: this.defaultAddressFormat,
        ss58Prefix: pointer.apiAt.registry.chainSS58,
        tokens: pointer.apiAt.registry.chainTokens,
        decimals: pointer.apiAt.registry.chainDecimals,
      },
    };
    
    return about;
  }
  
  public async updateCurrentMetadata(pointer: BlockPointer): Promise<void> {
    const about = await this.about(pointer);
    
    this.metadata = new Metadata({
      about,
      source: pointer.apiAt.registry.metadata,
      filter: this.filter,
    });
  }
  
  public async handleBlock(pointer: BlockPointer): Promise<Result<Event>> {
    if (pointer.runtimeVersion != this.metadata.runtimeVersion) {
      throw new Error(`block runtime version '${pointer.runtimeVersion}' is different from ` +
        `current metadata runtime version '${this.metadata.runtimeVersion}'`);
    }
    
    const signedBlock = await this.api.rpc.chain.getBlock(pointer.blockHash);
    const eventRecordsRaw = await pointer.apiAt.query.system.events();
    
    const eventRecords: EventRecord[] = eventRecordsRaw.map(item => {
      const index = (item.phase.isApplyExtrinsic)
        ? item.phase.asApplyExtrinsic.toNumber()
        : null
      ;
      
      return {
        event: item.event,
        index,
      };
    });
    
    const result = new Result<Event>();
    
    result.merge(handleEvents({
      filter: this.filter,
      metadata: this.metadata,
      blockNumber: pointer.blockNumber,
      eventRecords,
    }));
    
    result.merge(handleCalls({
      filter: this.filter,
      metadata: this.metadata,
      registry: pointer.apiAt.registry,
      eventRecords,
      block: signedBlock.block,
    }));
    
    return result;
  }
}
