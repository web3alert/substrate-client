import { snakeCase } from 'change-case';
import type { MetadataV14 } from '@polkadot/types/interfaces';
import type { EventSpec } from '../types';
import {
  Result,
  buildEventName,
} from '../utils';
import { formatDocs } from './format-docs';

type ParsedDocs = {
  text: string;
  argNames: string[];
};

const RE_DOCS_ARGS = /\\\[(.+?)\\\]/g;
const RE_DOCS_ARGS_2 = /\`\[(.+?)\]\`/g;
const RE_DOCS_ARGS_3 = /\`(.+?)\`/g;

const TRY_RE_DOCS_ARGS = [
  RE_DOCS_ARGS,
  RE_DOCS_ARGS_2,
  RE_DOCS_ARGS_3,
];

function parseDocs(docs: string): ParsedDocs {
  const trimmed = docs.trim();
  const argNames: string[] = [];
  
  let matches: RegExpMatchArray[] = [];
  
  for (const re of TRY_RE_DOCS_ARGS) {
    matches = Array.from(trimmed.matchAll(re));
    
    if (matches.length > 0) {
      break;
    }
  }
  
  for (const match of matches) {
    const commaSeparatedNames = match[1];
    const names = commaSeparatedNames.split(',').map(name => snakeCase(name.trim()));
    
    argNames.push(...names);
  }
  
  return {
    text: trimmed,
    argNames,
  };
}

export function parseEvents(source: MetadataV14): Result<EventSpec> {
  const result = new Result<EventSpec>();
  
  for (const pallet of source.pallets) {
    const moduleName = pallet.name.toString();
    
    if (pallet.events.isNone) {
      continue;
    }
    
    const eventsMetadata = pallet.events.unwrap();
    const eventsMetadataType = source.lookup.getSiType(eventsMetadata.type);
    
    if (!eventsMetadataType.def.isVariant) {
      throw new Error(`pallet ${moduleName} events metadata type is not a variant`);
    }
    
    const variants = eventsMetadataType.def.asVariant.variants;
    
    for (const variant of variants) {
      const eventName = variant.name.toString();
      
      const rawDocs = variant.docs.join('\n');
      const parsedDocs = parseDocs(rawDocs);
      
      let argNamesFromDocsUsed = false;
      const useFallbackNames = (parsedDocs.argNames.length != variant.fields.length);
      
      const args = variant.fields.map((field, index) => {
        const argType = field.type.toNumber();
        
        let argName: string;
        
        if (field.name.isSome) {
          argName = field.name.unwrap().toString();
        } else {
          argNamesFromDocsUsed = true;
          
          if (useFallbackNames) {
            argName = `arg${index}`;
          } else {
            argName = parsedDocs.argNames[index];
          }
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
      
      if (argNamesFromDocsUsed && useFallbackNames) {
        result.errors.push({
          message: 'parsed from docs event argument names count does not match real argument '
            + 'count, fallback names were used instead',
          details: {
            module: moduleName,
            event: eventName,
            docs: rawDocs,
            realArgsCount: variant.fields.length,
          },
        });
      }
      
      result.items.push({
        name: buildEventName({
          kind: 'event',
          module: moduleName,
          event: eventName,
        }),
        docs: formatDocs(parsedDocs.text),
        args,
      });
    }
  }
  
  return result;
}
