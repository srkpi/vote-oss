'use client';

import { VoteScene, type VoteSceneProps } from '@/components/three/vote-scene';

import { useHeroReady } from './hero-ready-context';

export function HeroVoteScene(props: Omit<VoteSceneProps, 'onSceneFullyLoaded'>) {
  const { markHeroReady } = useHeroReady();
  return <VoteScene {...props} onSceneFullyLoaded={markHeroReady} />;
}
