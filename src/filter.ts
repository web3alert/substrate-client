import micromatch from 'micromatch';

export type FilterOptions = {
  patterns: string[];
};

export class Filter {
  private patterns: string[];
  
  constructor(options: FilterOptions) {
    const {
      patterns,
    } = options;
    
    this.patterns = patterns;
  }
  
  public match(name: string): boolean {
    if (this.patterns.length == 0) {
      return true;
    }
    
    return micromatch.isMatch(name, this.patterns);
  }
}
