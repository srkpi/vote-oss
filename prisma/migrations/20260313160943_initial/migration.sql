-- CreateTable
CREATE TABLE "jwt_tokens" (
    "access_jti" TEXT NOT NULL,
    "refresh_jti" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "admins" (
    "user_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "faculty" TEXT NOT NULL,
    "promoted_by" TEXT,
    "promoted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "manage_admins" BOOLEAN NOT NULL DEFAULT false,
    "restricted_to_faculty" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "admin_invite_tokens" (
    "token_hash" TEXT NOT NULL,
    "max_usage" INTEGER NOT NULL,
    "current_usage" INTEGER NOT NULL DEFAULT 0,
    "manage_admins" BOOLEAN NOT NULL,
    "restricted_to_faculty" BOOLEAN NOT NULL,
    "valid_due" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "admin_invite_tokens_pkey" PRIMARY KEY ("token_hash")
);

-- CreateTable
CREATE TABLE "elections" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "opens_at" TIMESTAMP(3) NOT NULL,
    "closes_at" TIMESTAMP(3) NOT NULL,
    "restricted_to_faculty" TEXT,
    "restricted_to_group" TEXT,
    "public_key" TEXT NOT NULL,
    "private_key" TEXT NOT NULL,

    CONSTRAINT "elections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "election_choices" (
    "id" TEXT NOT NULL,
    "election_id" TEXT NOT NULL,
    "choice" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "election_choices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issued_tokens" (
    "id" TEXT NOT NULL,
    "election_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "issued_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ballots" (
    "id" TEXT NOT NULL,
    "election_id" TEXT NOT NULL,
    "encrypted_ballot" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signature" TEXT NOT NULL,
    "previous_hash" TEXT,
    "current_hash" TEXT NOT NULL,

    CONSTRAINT "ballots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "used_token_nullifiers" (
    "nullifier" TEXT NOT NULL,
    "election_id" TEXT NOT NULL,

    CONSTRAINT "used_token_nullifiers_pkey" PRIMARY KEY ("nullifier")
);

-- CreateTable
CREATE TABLE "election_tallies" (
    "election_id" TEXT NOT NULL,
    "choice_id" TEXT NOT NULL,
    "vote_count" INTEGER NOT NULL,

    CONSTRAINT "election_tallies_pkey" PRIMARY KEY ("election_id","choice_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jwt_tokens_access_jti_key" ON "jwt_tokens"("access_jti");

-- CreateIndex
CREATE UNIQUE INDEX "jwt_tokens_refresh_jti_key" ON "jwt_tokens"("refresh_jti");

-- CreateIndex
CREATE INDEX "admin_invite_tokens_created_by_idx" ON "admin_invite_tokens"("created_by");

-- CreateIndex
CREATE INDEX "election_choices_election_id_position_idx" ON "election_choices"("election_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "issued_tokens_election_id_user_id_key" ON "issued_tokens"("election_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ballots_encrypted_ballot_key" ON "ballots"("encrypted_ballot");

-- CreateIndex
CREATE UNIQUE INDEX "ballots_current_hash_key" ON "ballots"("current_hash");

-- CreateIndex
CREATE INDEX "ballots_election_id_idx" ON "ballots"("election_id");

-- CreateIndex
CREATE INDEX "used_token_nullifiers_election_id_idx" ON "used_token_nullifiers"("election_id");

-- AddForeignKey
ALTER TABLE "admins" ADD CONSTRAINT "admins_promoted_by_fkey" FOREIGN KEY ("promoted_by") REFERENCES "admins"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_invite_tokens" ADD CONSTRAINT "admin_invite_tokens_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admins"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elections" ADD CONSTRAINT "elections_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admins"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_choices" ADD CONSTRAINT "election_choices_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issued_tokens" ADD CONSTRAINT "issued_tokens_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "used_token_nullifiers" ADD CONSTRAINT "used_token_nullifiers_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_tallies" ADD CONSTRAINT "election_tallies_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_tallies" ADD CONSTRAINT "election_tallies_choice_id_fkey" FOREIGN KEY ("choice_id") REFERENCES "election_choices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
