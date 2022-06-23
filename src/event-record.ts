import type { Event } from '@polkadot/types/interfaces';

export type EventRecord = {
  event: Event;
  index: number | null;
};
