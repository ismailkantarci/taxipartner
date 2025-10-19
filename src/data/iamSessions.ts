import type { IamSession } from './iamTypes';

export const iamSeedSessions = [
  {
    id: 'sess-bq93fs',
    userEmail: 'nina.kraus@taxipartner.test',
    device: 'MacOS · Chrome',
    location: 'Viyana, AT',
    lastSeen: '2024-10-16T09:22:00Z',
    status: 'active'
  },
  {
    id: 'sess-cu108d',
    userEmail: 'marco.huber@taxipartner.test',
    device: 'Windows · Edge',
    location: 'Berlin, DE',
    lastSeen: '2024-10-15T17:05:00Z',
    status: 'active'
  },
  {
    id: 'sess-lm221a',
    userEmail: 'eva.leitner@taxipartner.test',
    device: 'iOS · Safari',
    location: 'Graz, AT',
    lastSeen: '2024-10-14T21:12:00Z',
    status: 'revoked'
  },
  {
    id: 'sess-zk482m',
    userEmail: 'lena.berger@taxipartner.test',
    device: 'MacOS · Safari',
    location: 'Salzburg, AT',
    lastSeen: '2024-10-16T06:48:00Z',
    status: 'active'
  }
] satisfies IamSession[];
