import { sanitize } from '@polkadot/types-codec';
import type { MetadataV14 } from '@polkadot/types/interfaces';
import type { EventSpec } from '../types';
import {
  Result,
  buildEventName,
} from '../utils';
import type { TypeRegistry } from './type-registry';
import { formatDocs } from './format-docs';

export function parseCalls(source: MetadataV14, types: TypeRegistry): Result<EventSpec> {
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
      const name = buildEventName({ kind: 'call', module: moduleName, event: callName });
      
      const docs = variant.docs.join('\n');
      
      let fallbackNameUsed = false;
      
      const args = variant.fields.map((field, index) => {
        let argName: string;
        
        if (field.name.isSome) {
          argName = field.name.unwrap().toString();
        } else {
          fallbackNameUsed = true;
          
          argName = `arg${index}`;
        }
        
        const typeDefSource = source.lookup.getTypeDef(field.type);
        const typeDef = Object.assign({}, typeDefSource);
        const typeName = field.typeName.isSome ? field.typeName.unwrap().toString() : null;
        if (typeName) {
          typeDef.typeName = sanitize(typeName);
        }
        
        const typeHandler = types.get(typeDef, `${name.full}.${argName}`);
        
        return {
          name: argName,
          spec: typeHandler.spec,
          parse: typeHandler.parse,
          debug: {
            typeDef: typeDefSource,
            typeName: (typeName) ? { raw: typeName, sanitized: sanitize(typeName) } : null,
          },
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
        name,
        docs: formatDocs(docs),
        args,
      });
    }
  }
  
  return result;
}
