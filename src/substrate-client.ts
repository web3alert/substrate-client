import {
  WsProvider,
  ApiPromise,
} from '@polkadot/api';
import type { ApiDecoration } from '@polkadot/api/types';
import type {
  About,
  Event,
} from './types';
import type { EventRecord } from './event-record';
import { Result } from './utils';
import {
  LegacyTypeRegistry,
  Metadata,
} from './metadata';
import { handleEvents } from './handle-events';
import { handleCalls } from './handle-calls';

type ApiAt = ApiDecoration<'promise'>;

type InternalAbout = {
  about: About;
  apiAt: ApiAt;
};

const SUPPORTED_METADATA_VERSION = 14;

export type SubstrateClientOptions = {
  legacyTypeRegistry: LegacyTypeRegistry;
};

export class SubstrateClient {
  private legacyTypeRegistry: LegacyTypeRegistry;
  
  public api!: ApiPromise;
  public metadata!: Metadata;
  
  constructor(options: SubstrateClientOptions) {
    const { legacyTypeRegistry } = options;
    
    this.legacyTypeRegistry = legacyTypeRegistry;
  }
  
  public async connect(wsUrl: string): Promise<void> {
    this.api = await ApiPromise.create({
      provider: new WsProvider(wsUrl),
    });
    
    const metadataVersion = this.api.runtimeMetadata.version;
    
    if (metadataVersion != SUPPORTED_METADATA_VERSION) {
      await this.api.disconnect();
      
      throw new Error(`runtime metadata version is '${metadataVersion}', which is not supported`);
    }
    
    const currentBlockNumber = await this.currentBlockNumber();
    await this.updateCurrentMetadata(currentBlockNumber);
  }
  
  public async close(): Promise<void> {
    await this.api.disconnect();
  }
  
  private async internalAbout(blockNumber: number): Promise<InternalAbout> {
    const nodeName = await this.api.rpc.system.name();
    const nodeVersion = await this.api.rpc.system.version();
    
    const blockHash = await this.api.rpc.chain.getBlockHash(blockNumber);
    const apiAt = await this.api.at(blockHash);
    
    const runtimeVersion = apiAt.consts.system.version;
    const chainProperties = apiAt.registry.getChainProperties();
    
    if (!chainProperties) {
      throw new Error('cannot retrive chain properties');
    }
    
    const about: About = {
      node: {
        name: nodeName.toString(),
        version: nodeVersion.toString(),
      },
      block: {
        number: blockNumber,
        hash: blockHash.toHex(),
      },
      chain: {
        name: runtimeVersion.specName.toString(),
        version: runtimeVersion.specVersion.toNumber(),
        ss58Prefix: apiAt.registry.chainSS58,
        tokens: apiAt.registry.chainTokens,
        decimals: apiAt.registry.chainDecimals,
      },
    };
    
    return {
      about,
      apiAt,
    };
  }
  
  public async currentBlockNumber(): Promise<number> {
    const blockHash = await this.api.rpc.chain.getFinalizedHead();
    const blockHeader = await this.api.rpc.chain.getHeader(blockHash);
    
    return blockHeader.number.toNumber();
  }
  
  public async about(blockNumber: number): Promise<About> {
    const { about } = await this.internalAbout(blockNumber);
    
    return about;
  }
  
  public async updateCurrentMetadata(blockNumber: number): Promise<void> {
     const { about, apiAt } = await this.internalAbout(blockNumber);
    
    this.metadata = new Metadata({
      about,
      source: apiAt.registry.metadata,
      legacyTypeRegistry: this.legacyTypeRegistry,
    });
  }
  
  public async handleBlock(blockNumber: number): Promise<Result<Event>> {
    const blockHash = await this.api.rpc.chain.getBlockHash(blockNumber);
    const apiAt = await this.api.at(blockHash);
    const runtimeVersion = apiAt.consts.system.version.specVersion.toNumber();
    
    if (runtimeVersion != this.metadata.about.chain.version) {
      // TODO: throw detailed error
      throw new Error('block runtime version is different from current metadata runtime version');
    }
    
    const signedBlock = await this.api.rpc.chain.getBlock(blockHash);
    const eventRecordsRaw = await apiAt.query.system.events();
    
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
      metadata: this.metadata,
      blockNumber,
      eventRecords,
    }));
    
    result.merge(handleCalls({
      metadata: this.metadata,
      registry: apiAt.registry,
      eventRecords,
      block: signedBlock.block,
    }));
    
    return result;
  }
}
