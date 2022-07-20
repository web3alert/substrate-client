export type Entry<I extends string | number> = {
  key: I;
  paths: string[];
};

export class Multiset<I extends string | number> {
  private map: Map<I, string[]>;
  
  constructor() {
    this.map = new Map();
  }
  
  public add(key: I, path: string): void {
    let paths = this.map.get(key);
    if (!paths) {
      paths = [];
      
      this.map.set(key, paths);
    }
    
    paths.push(path);
  }
  
  public entries(): Entry<I>[] {
    const result: Entry<I>[] = [];
    
    for (const [key, paths] of this.map.entries()) {
      result.push({ key, paths });
    }
    
    return result;
  }
}
