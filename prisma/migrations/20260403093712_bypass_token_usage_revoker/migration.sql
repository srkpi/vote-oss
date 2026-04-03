-- AddForeignKey
ALTER TABLE "global_bypass_token_usages" ADD CONSTRAINT "global_bypass_token_usages_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "admins"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_bypass_token_usages" ADD CONSTRAINT "election_bypass_token_usages_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "admins"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
