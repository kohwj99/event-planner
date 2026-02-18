/**
 * unionFind.ts
 *
 * Generic Union-Find (Disjoint Set Union) data structure.
 * Uses path compression and union by rank for near-constant time operations.
 *
 * In the autofill algorithm, this is used to group guests who must sit together
 * into transitive clusters. For example, if A must sit with B and B must sit
 * with C, all three are grouped into one cluster [A, B, C].
 */

export class UnionFind {
  private parent: Map<string, string>;
  private rank: Map<string, number>;

  constructor() {
    this.parent = new Map();
    this.rank = new Map();
  }

  makeSet(x: string): void {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
  }

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.makeSet(x);
    }
    if (this.parent.get(x) !== x) {
      this.parent.set(x, this.find(this.parent.get(x)!)); // Path compression
    }
    return this.parent.get(x)!;
  }

  union(x: string, y: string): void {
    const rootX = this.find(x);
    const rootY = this.find(y);

    if (rootX === rootY) return;

    // Union by rank
    const rankX = this.rank.get(rootX) || 0;
    const rankY = this.rank.get(rootY) || 0;

    if (rankX < rankY) {
      this.parent.set(rootX, rootY);
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX);
    } else {
      this.parent.set(rootY, rootX);
      this.rank.set(rootX, rankX + 1);
    }
  }

  getGroups(): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    for (const x of this.parent.keys()) {
      const root = this.find(x);
      if (!groups.has(root)) {
        groups.set(root, []);
      }
      groups.get(root)!.push(x);
    }
    return groups;
  }
}
