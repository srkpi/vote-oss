export const avatarsMock = {
  getAvatarUrlMap: jest.fn().mockImplementation(() => Promise.resolve(new Map())),
  setCachedAvatarUrl: jest.fn().mockImplementation(() => Promise.resolve(undefined)),
  clearCachedAvatarUrl: jest.fn().mockImplementation(() => Promise.resolve(undefined)),
  withAvatarUrl: jest
    .fn()
    .mockImplementation(
      <T extends { userId: string }>(entity: T, avatarMap: Map<string, string>) => {
        const map = avatarMap || new Map();
        return {
          ...entity,
          avatarUrl: map.get(entity.userId) ?? null,
        };
      },
    ),
};

export function resetAvatarsMock(): void {
  avatarsMock.getAvatarUrlMap.mockReset().mockImplementation(() => Promise.resolve(new Map()));
  avatarsMock.setCachedAvatarUrl.mockReset().mockImplementation(() => Promise.resolve(undefined));
  avatarsMock.clearCachedAvatarUrl.mockReset().mockImplementation(() => Promise.resolve(undefined));

  avatarsMock.withAvatarUrl
    .mockReset()
    .mockImplementation(
      <T extends { userId: string }>(entity: T, avatarMap: Map<string, string>) => {
        const map = avatarMap || new Map();
        return {
          ...entity,
          avatarUrl: map.get(entity.userId) ?? null,
        };
      },
    );
}
