/**
 * Typed deep mock of the Prisma client.
 * Each model delegate exposes jest.fn() for every method used in the codebase.
 * Import `prismaMock` in test files and call jest.mock('@/lib/prisma', mockPrismaModule).
 */

export const prismaMock = {
  jwtToken: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    deleteMany: jest.fn(),
  },
  admin: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  adminInviteToken: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  election: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  electionChoice: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  issuedToken: {
    findUnique: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  ballot: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn(),
  },
  usedTokenNullifier: {
    findUnique: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  electionTally: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

/** Reset all mock implementations/calls without clearing the references */
export function resetPrismaMock() {
  Object.values(prismaMock).forEach((delegate) => {
    if (typeof delegate === 'object' && delegate !== null) {
      Object.values(delegate).forEach((fn) => {
        if (typeof fn === 'function') {
          (fn as jest.Mock).mockReset();
        }
      });
    }
    if (typeof delegate === 'function') {
      (delegate as jest.Mock).mockReset();
    }
  });

  prismaMock.ballot.create.mockImplementation((args: unknown) => args);
  prismaMock.usedTokenNullifier.create.mockImplementation((args: unknown) => args);
  prismaMock.admin.create.mockImplementation((args: unknown) => args);
  prismaMock.adminInviteToken.create.mockImplementation((args: unknown) => args);
}
