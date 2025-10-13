'use client';
import { useTestStore } from '@/store/testStore';

export default function Counter() {
  const { count, increment } = useTestStore();
  return (
    <button onClick={increment}>Count is {count}</button>
  );
}
