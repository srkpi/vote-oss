import { vi, type Mock } from 'vitest';

/**
 * Typed deep mock of the Prisma client.
 * Each model delegate exposes vi.fn() for every method used in the codebase.
 * Import `prismaMock` in test files and call vi.mock('@/lib/prisma', mockPrismaModule).
 */

export const prismaMock = {
  jwtToken: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
  },
  admin: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  adminInviteToken: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  election: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  electionChoice: {
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  issuedToken: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  ballot: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
    deleteMany: vi.fn(),
  },
  usedTokenNullifier: {
    findUnique: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  faqCategory: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  faqItem: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  globalBypassToken: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  globalBypassTokenUsage: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  electionBypassToken: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  electionBypassTokenUsage: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  group: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  groupMember: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  groupInviteLink: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
};

/** Reset all mock implementations/calls without clearing the references */
export function resetPrismaMock() {
  Object.values(prismaMock).forEach((delegate) => {
    if (typeof delegate === 'object' && delegate !== null) {
      Object.values(delegate).forEach((fn) => {
        if (typeof fn === 'function') {
          (fn as Mock).mockReset();
        }
      });
    }
    if (typeof delegate === 'function') {
      (delegate as Mock).mockReset();
    }
  });

  prismaMock.ballot.create.mockImplementation((args: unknown) => args);
  prismaMock.usedTokenNullifier.create.mockImplementation((args: unknown) => args);
  prismaMock.admin.create.mockImplementation((args: unknown) => args);
  prismaMock.admin.update.mockImplementation((args: unknown) => args);
  prismaMock.admin.updateMany.mockImplementation((args: unknown) => args);
  prismaMock.adminInviteToken.create.mockImplementation((args: unknown) => args);
  prismaMock.adminInviteToken.count.mockResolvedValue(0);
  prismaMock.electionChoice.update.mockResolvedValue({});
  prismaMock.election.update.mockResolvedValue({});
  prismaMock.faqCategory.create.mockImplementation((args: unknown) => args);
  prismaMock.faqCategory.update.mockImplementation((args: unknown) => args);
  prismaMock.faqItem.create.mockImplementation((args: unknown) => args);
  prismaMock.faqItem.update.mockImplementation((args: unknown) => args);
  prismaMock.issuedToken.findUnique.mockResolvedValue(null);
  prismaMock.issuedToken.findMany.mockResolvedValue([]);

  prismaMock.globalBypassToken.findUnique.mockReset().mockResolvedValue(null);
  prismaMock.globalBypassToken.findMany.mockReset().mockResolvedValue([]);
  prismaMock.globalBypassToken.create.mockReset().mockImplementation((args: unknown) => args);
  prismaMock.globalBypassToken.update.mockReset().mockResolvedValue({});
  prismaMock.globalBypassToken.delete.mockReset().mockResolvedValue({});
  prismaMock.globalBypassToken.deleteMany.mockReset().mockResolvedValue({ count: 0 });
  prismaMock.globalBypassToken.count.mockReset().mockResolvedValue(0);
  prismaMock.globalBypassTokenUsage.findUnique.mockReset().mockResolvedValue(null);
  prismaMock.globalBypassTokenUsage.findFirst.mockReset().mockResolvedValue(null);
  prismaMock.globalBypassTokenUsage.findMany.mockReset().mockResolvedValue([]);
  prismaMock.globalBypassTokenUsage.create.mockReset().mockImplementation((args: unknown) => args);
  prismaMock.globalBypassTokenUsage.update.mockReset().mockResolvedValue({});
  prismaMock.globalBypassTokenUsage.updateMany.mockReset().mockResolvedValue({ count: 0 });

  prismaMock.electionBypassToken.findUnique.mockReset().mockResolvedValue(null);
  prismaMock.electionBypassToken.findMany.mockReset().mockResolvedValue([]);
  prismaMock.electionBypassToken.create.mockReset().mockImplementation((args: unknown) => args);
  prismaMock.electionBypassToken.update.mockReset().mockResolvedValue({});
  prismaMock.electionBypassToken.delete.mockReset().mockResolvedValue({});
  prismaMock.electionBypassToken.deleteMany.mockReset().mockResolvedValue({ count: 0 });
  prismaMock.electionBypassToken.count.mockReset().mockResolvedValue(0);
  prismaMock.electionBypassTokenUsage.findUnique.mockReset().mockResolvedValue(null);
  prismaMock.electionBypassTokenUsage.findFirst.mockReset().mockResolvedValue(null);
  prismaMock.electionBypassTokenUsage.findMany.mockReset().mockResolvedValue([]);
  prismaMock.electionBypassTokenUsage.create
    .mockReset()
    .mockImplementation((args: unknown) => args);
  prismaMock.electionBypassTokenUsage.update.mockReset().mockResolvedValue({});
  prismaMock.electionBypassTokenUsage.updateMany.mockReset().mockResolvedValue({ count: 0 });

  prismaMock.group.findUnique.mockReset().mockResolvedValue(null);
  prismaMock.group.findMany.mockReset().mockResolvedValue([]);
  prismaMock.group.create.mockReset().mockImplementation((args: unknown) => args);
  prismaMock.group.update.mockReset().mockResolvedValue({});
  prismaMock.group.count.mockReset().mockResolvedValue(0);
  prismaMock.groupMember.findUnique.mockReset().mockResolvedValue(null);
  prismaMock.groupMember.findMany.mockReset().mockResolvedValue([]);
  prismaMock.groupMember.create.mockReset().mockImplementation((args: unknown) => args);
  prismaMock.groupMember.update.mockReset().mockResolvedValue({});
  prismaMock.groupInviteLink.findUnique.mockReset().mockResolvedValue(null);
  prismaMock.groupInviteLink.findMany.mockReset().mockResolvedValue([]);
}
