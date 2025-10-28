import bcrypt from 'bcryptjs';

export function hashPassword(plain) {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(plain, salt);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}
