// NATS patterns for the users microservice.
export const USERS_PATTERNS = {
  health: 'users.health',
  create: 'users.create',
  findAll: 'users.findAll',
  findOne: 'users.findOne',
  update: 'users.update',
  remove: 'users.remove',
  findByEmail: 'users.findByEmail',
  updateLastLogin: 'users.updateLastLogin',
} as const;
