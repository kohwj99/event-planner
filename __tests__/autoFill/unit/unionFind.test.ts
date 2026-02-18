import { describe, it, expect } from 'vitest';
import { UnionFind } from '@/utils/autoFill/unionFind';

describe('UnionFind', () => {
  describe('makeSet', () => {
    it('creates a new set for an element', () => {
      const uf = new UnionFind();
      uf.makeSet('a');
      expect(uf.find('a')).toBe('a');
    });

    it('is idempotent (calling twice does not error)', () => {
      const uf = new UnionFind();
      uf.makeSet('a');
      uf.makeSet('a');
      expect(uf.find('a')).toBe('a');
    });
  });

  describe('find', () => {
    it('returns the element itself for a singleton set', () => {
      const uf = new UnionFind();
      uf.makeSet('x');
      expect(uf.find('x')).toBe('x');
    });

    it('returns the root after union', () => {
      const uf = new UnionFind();
      uf.makeSet('a');
      uf.makeSet('b');
      uf.union('a', 'b');
      const rootA = uf.find('a');
      const rootB = uf.find('b');
      expect(rootA).toBe(rootB);
    });

    it('applies path compression', () => {
      const uf = new UnionFind();
      uf.makeSet('a');
      uf.makeSet('b');
      uf.makeSet('c');
      uf.union('a', 'b');
      uf.union('b', 'c');
      // After find with path compression, all should point to root
      const root = uf.find('c');
      expect(uf.find('a')).toBe(root);
      expect(uf.find('b')).toBe(root);
    });

    it('auto-creates set for unknown element', () => {
      const uf = new UnionFind();
      // find on non-existing element should auto-create
      expect(uf.find('new')).toBe('new');
    });
  });

  describe('union', () => {
    it('merges two singleton sets', () => {
      const uf = new UnionFind();
      uf.makeSet('a');
      uf.makeSet('b');
      uf.union('a', 'b');
      expect(uf.find('a')).toBe(uf.find('b'));
    });

    it('merges already-connected sets (idempotent)', () => {
      const uf = new UnionFind();
      uf.makeSet('a');
      uf.makeSet('b');
      uf.union('a', 'b');
      uf.union('a', 'b');
      expect(uf.find('a')).toBe(uf.find('b'));
    });

    it('handles chain unions: A-B, B-C results in one group', () => {
      const uf = new UnionFind();
      uf.makeSet('a');
      uf.makeSet('b');
      uf.makeSet('c');
      uf.union('a', 'b');
      uf.union('b', 'c');
      expect(uf.find('a')).toBe(uf.find('c'));
    });

    it('uses union by rank (taller tree becomes root)', () => {
      const uf = new UnionFind();
      // Build a tree of rank 1 from a-b
      uf.makeSet('a');
      uf.makeSet('b');
      uf.union('a', 'b');

      // Union with a fresh singleton 'c' should keep a-b root
      uf.makeSet('c');
      uf.union('a', 'c');

      // All should share the same root
      const root = uf.find('a');
      expect(uf.find('b')).toBe(root);
      expect(uf.find('c')).toBe(root);
    });
  });

  describe('getGroups', () => {
    it('returns one group per connected component', () => {
      const uf = new UnionFind();
      uf.makeSet('a');
      uf.makeSet('b');
      uf.makeSet('c');
      uf.makeSet('d');
      uf.union('a', 'b');
      uf.union('c', 'd');

      const groups = uf.getGroups();
      expect(groups.size).toBe(2);
    });

    it('returns correct members in each group', () => {
      const uf = new UnionFind();
      uf.makeSet('a');
      uf.makeSet('b');
      uf.makeSet('c');
      uf.union('a', 'b');

      const groups = uf.getGroups();
      let abGroup: string[] = [];
      let cGroup: string[] = [];

      for (const [, members] of groups) {
        if (members.includes('a')) abGroup = members;
        if (members.includes('c')) cGroup = members;
      }

      expect(abGroup.sort()).toEqual(['a', 'b']);
      expect(cGroup).toEqual(['c']);
    });

    it('handles single element', () => {
      const uf = new UnionFind();
      uf.makeSet('solo');
      const groups = uf.getGroups();
      expect(groups.size).toBe(1);
      const members = Array.from(groups.values())[0];
      expect(members).toEqual(['solo']);
    });

    it('handles no elements (empty map)', () => {
      const uf = new UnionFind();
      const groups = uf.getGroups();
      expect(groups.size).toBe(0);
    });

    it('groups A-B-C and D-E into two separate groups', () => {
      const uf = new UnionFind();
      ['a', 'b', 'c', 'd', 'e'].forEach(x => uf.makeSet(x));
      uf.union('a', 'b');
      uf.union('b', 'c');
      uf.union('d', 'e');

      const groups = uf.getGroups();
      expect(groups.size).toBe(2);

      let group1: string[] = [];
      let group2: string[] = [];
      for (const [, members] of groups) {
        if (members.includes('a')) group1 = members;
        if (members.includes('d')) group2 = members;
      }

      expect(group1.sort()).toEqual(['a', 'b', 'c']);
      expect(group2.sort()).toEqual(['d', 'e']);
    });
  });
});
