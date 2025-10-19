import bcrypt from 'bcryptjs';
export const hash = (input) => bcrypt.hash(input, 10);
export const compare = (input, hashed) => bcrypt.compare(input, hashed);
