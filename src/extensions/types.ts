import type { RegistryTypes } from '@polkadot/types-codec/types';
import type { DefinitionRpc, DefinitionRpcSub } from '@polkadot/types/types';
import type { ExtDef } from '@polkadot/types/extrinsic/signedExtensions/types';

export type Extension = {
  rpc?: Record<string, Record<string, DefinitionRpc | DefinitionRpcSub>>;
  signedExtensions?: ExtDef;
  types?: RegistryTypes;
};
