import bcrypt from 'bcryptjs';

export const hash = (input: string) => bcrypt.hash(input, 10);
export const compare = (input: string, hashed: string) => bcrypt.compare(input, hashed);
