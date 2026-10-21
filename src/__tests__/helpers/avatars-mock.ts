export const avatarsMock = {
  getAvatarUrlMap: jest.fn().mockImplementation(() => Promise.resolve(new Map())),
  setCachedAvatarUrl: jest.fn().mockImplementation(() => Promise.resolve(undefined)),
  clearCachedAvatarUrl: jest.fn().mockImplementation(() => Promise.resolve(undefined)),
};

export function resetAvatarsMock(): void {
  avatarsMock.getAvatarUrlMap.mockReset().mockImplementation(() => Promise.resolve(new Map()));
  avatarsMock.setCachedAvatarUrl.mockReset().mockImplementation(() => Promise.resolve(undefined));
  avatarsMock.clearCachedAvatarUrl.mockReset().mockImplementation(() => Promise.resolve(undefined));
}
