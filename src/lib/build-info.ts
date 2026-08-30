import {
  APP_URL,
  BUILD_TIME,
  DOCKER_IMAGE,
  DOCKER_TAG,
  GIT_REPO,
  GIT_SHA,
  GITHUB_RUN_ID,
} from '@/lib/config/client';

export interface BuildInfoDocker {
  image: string;
  tag: string;
  reference: string;
  hubUrl: string;
}

export interface BuildInfoVerify {
  inspect: string;
  attest: string;
  scriptUrl: string;
  scriptCommand: string;
}

export interface BuildInfo {
  isLocalBuild: boolean;
  commit: string | null;
  commitShort: string | null;
  commitUrl: string | null;
  repo: string | null;
  builtAt: string | null;
  actionsRunUrl: string | null;
  docker: BuildInfoDocker | null;
  verify: BuildInfoVerify | null;
}

export function getBuildInfo(): BuildInfo {
  const commit = GIT_SHA || null;
  const repo = GIT_REPO || null;
  const commitShort = commit ? commit.slice(0, 7) : null;

  const commitUrl = commit && repo ? `https://github.com/${repo}/commit/${commit}` : null;
  const actionsRunUrl =
    repo && GITHUB_RUN_ID ? `https://github.com/${repo}/actions/runs/${GITHUB_RUN_ID}` : null;

  const docker: BuildInfoDocker | null =
    DOCKER_IMAGE && DOCKER_TAG
      ? {
          image: DOCKER_IMAGE,
          tag: DOCKER_TAG,
          reference: `${DOCKER_IMAGE}:${DOCKER_TAG}`,
          hubUrl: `https://hub.docker.com/r/${DOCKER_IMAGE}/tags?name=${DOCKER_TAG}`,
        }
      : null;

  const verify: BuildInfoVerify | null =
    docker && repo && commit
      ? {
          inspect: `docker buildx imagetools inspect ${docker.reference}`,
          attest: `gh attestation verify oci://docker.io/${docker.reference} --repo ${repo}`,
          scriptUrl: `https://raw.githubusercontent.com/${repo}/${commit}/scripts/verify-deployment.cjs`,
          scriptCommand: `curl -fsSL https://raw.githubusercontent.com/${repo}/${commit}/scripts/verify-deployment.cjs | node - ${APP_URL}`,
        }
      : null;

  return {
    isLocalBuild: !commit,
    commit,
    commitShort,
    commitUrl,
    repo,
    builtAt: BUILD_TIME || null,
    actionsRunUrl,
    docker,
    verify,
  };
}
