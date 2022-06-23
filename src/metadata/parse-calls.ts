import type { MetadataV14 } from '@polkadot/types/interfaces';
import type { EventSpec } from '../types';
import {
  Result,
  buildEventName,
} from '../utils';
import { formatDocs } from './format-docs';

export function parseCalls(source: MetadataV14): Result<EventSpec> {
  const result = new Result<EventSpec>();
  
  for (const pallet of source.pallets) {
    const moduleName = pallet.name.toString();
    
    if (pallet.calls.isNone) {
      continue;
    }
    
    const callsMetadata = pallet.calls.unwrap();
    const callsMetadataType = source.lookup.getSiType(callsMetadata.type);
    
    if (!callsMetadataType.def.isVariant) {
      throw new Error(`pallet ${moduleName} calls metadata type is not a variant`);
    }
    
    const variants = callsMetadataType.def.asVariant.variants;
    
    for (const variant of variants) {
      const callName = variant.name.toString();
      
      const docs = variant.docs.join('\n');
      
      let fallbackNameUsed = false;
      
      const args = variant.fields.map((field, index) => {
        const argType = field.type.toNumber();
        
        let argName: string;
        
        if (field.name.isSome) {
          argName = field.name.unwrap().toString();
        } else {
          fallbackNameUsed = true;
          
          argName = `arg${index}`;
        }
        
        return {
          name: argName,
          type: argType,
          comment: (field.typeName.isSome)
            ? `from field: ${field.typeName.unwrap().toString()}`
            : `from si lookup: ${source.lookup.getName(argType)}`
          ,
        };
      });
      
      if (fallbackNameUsed) {
        result.errors.push({
          message: 'some call argument names are undefined, fallback names were used instead',
          details: {
            module: moduleName,
            call: callName,
            argNames: args.map(arg => arg.name),
          },
        });
      }
      
      result.items.push({
        name: buildEventName({
          kind: 'call',
          module: moduleName,
          event: callName,
        }),
        docs: formatDocs(docs),
        args,
      });
    }
  }
  
  return result;
}
