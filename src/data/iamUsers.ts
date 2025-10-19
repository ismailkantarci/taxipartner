import type { IamUser } from './iamTypes';

export const iamSeedUsers = [
  {
    id: 'user-001',
    email: 'nina.kraus@taxipartner.test',
    fullName: 'Nina Kraus',
    role: 'Operations Admin'
  },
  {
    id: 'user-002',
    email: 'marco.huber@taxipartner.test',
    fullName: 'Marco Huber',
    role: 'Compliance Officer'
  },
  {
    id: 'user-003',
    email: 'eva.leitner@taxipartner.test',
    fullName: 'Eva Leitner',
    role: 'Risk Analyst'
  },
  {
    id: 'user-004',
    email: 'lena.berger@taxipartner.test',
    fullName: 'Lena Berger',
    role: 'Fleet Supervisor'
  },
  {
    id: 'user-005',
    email: 'oliver.brandt@taxipartner.test',
    fullName: 'Oliver Brandt',
    role: 'Security Operations'
  }
] satisfies IamUser[];
