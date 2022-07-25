import type {
  About,
  CurrencyInfo,
} from '../types';

export type CurrencyRegistryOptions = {
  about: About;
}

export class CurrencyRegistry {
  private about: About;
  
  constructor(options: CurrencyRegistryOptions) {
    const {
      about,
    } = options;
    
    this.about = about;
  }
  
  public get(symbol: string): CurrencyInfo | undefined {
    const index = this.about.chain.tokens.indexOf(symbol);
    
    if (index != -1) {
      const decimals = this.about.chain.decimals[index];
      
      return { symbol, decimals };
    }
    
    return undefined;
  }
}
