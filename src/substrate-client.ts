import type { BlockHash } from '@polkadot/types/interfaces';
import type { RegistryTypes } from '@polkadot/types/types';
import {
  WsProvider,
  ApiPromise,
  HttpProvider
} from '@polkadot/api';
import type { ApiDecoration } from '@polkadot/api/types';
import type {
  AddressFormat,
  About,
  Event,
} from './types';
import type { EventRecord } from './event-record';
import { Result } from './utils';
import {
  TypeMappings,
  Metadata,
} from './metadata';
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

export type SubstrateClientConfig = {
  lookupPathsWhitelist?: string[];
};

export type SubstrateClientOptions = {
  wsUrl: string;
  customClientTypes?: RegistryTypes;
  config?: SubstrateClientConfig;
  defaultAddressFormat?: AddressFormat;
  filter?: {
    patterns: string[];
  };
  typeMappings?: TypeMappings;
};

export class SubstrateClient {
  public wsUrl: string;
  private isHttps: boolean;
  public customClientTypes?: RegistryTypes;
  public config?: SubstrateClientConfig;
  public defaultAddressFormat: AddressFormat;
  public api!: ApiPromise;
  public filter: Filter;
  public typeMappings?: TypeMappings;
  public metadata!: Metadata;
  
  constructor(options: SubstrateClientOptions) {
    const {
      wsUrl,
      customClientTypes,
      config,
      defaultAddressFormat,
      filter,
      typeMappings,
    } = options;
    
    this.wsUrl = wsUrl;
    this.isHttps = wsUrl.startsWith('http') || wsUrl.startsWith('https');
    this.customClientTypes = customClientTypes;
    this.config = config;
    this.defaultAddressFormat = defaultAddressFormat ?? 'substrate';
    this.filter = new Filter({
      patterns: filter?.patterns ?? [],
    });
    this.typeMappings = typeMappings;
  }
  
  public async connect(): Promise<void> {
    if(!this.isHttps){
      this.api = await ApiPromise.create({
        provider: new WsProvider(this.wsUrl),
        types: this.customClientTypes,
      });
    }
    else if(this.isHttps){
      this.api = await ApiPromise.create({
        provider: new HttpProvider(this.wsUrl),
        types: this.customClientTypes,
      })
    }
    
    try {
      const currentBlockNumber = await this.currentBlockNumber();
      const pointer = await this.blockPointer(currentBlockNumber);
      
      await this.updateCurrentMetadata(pointer);
    } catch (err) {
      if(!this.isHttps){
        await this.api.disconnect();
      }
      
      throw err;
    }
  }
  
  public async close(): Promise<void> {
    if(!this.isHttps){
      await this.api.disconnect();
    }
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
      typeMappings: this.typeMappings,
      lookupPathsWhitelist: this.config?.lookupPathsWhitelist,
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
    
    result.merge(await handleEvents({
      api: this.api,
      filter: this.filter,
      metadata: this.metadata,
      blockNumber: pointer.blockNumber,
      eventRecords,
    }));
    
    result.merge(await handleCalls({
      api: this.api,
      filter: this.filter,
      metadata: this.metadata,
      registry: pointer.apiAt.registry,
      eventRecords,
      block: signedBlock.block,
    }));
    
    return result;
  }
}
