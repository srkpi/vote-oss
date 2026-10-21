import { adminInvitesRoutes } from './admin-invites';
import { adminsRoutes } from './admins';
import { authRoutes } from './auth';
import { bypassRoutes } from './bypass';
import { campusRoutes } from './campus';
import { candidateRegistrationFormsRoutes } from './candidate-registration-forms';
import { candidateRegistrationsRoutes } from './candidate-registrations';
import { cronRoutes } from './cron';
import { electionCampaignsRoutes } from './election-campaigns';
import { electionsRoutes } from './elections';
import { faqRoutes } from './faq';
import { groupsRoutes } from './groups';
import { petitionCommentsRoutes } from './petition-comments';
import { protocolsRoutes } from './protocols';
import { statsRoutes } from './stats';
import { systemRoutes } from './system';
import { teamInvitesRoutes } from './team-invites';
import { usersRoutes } from './users';

export const documentedRoutes = [
  ...adminInvitesRoutes,
  ...adminsRoutes,
  ...authRoutes,
  ...bypassRoutes,
  ...campusRoutes,
  ...candidateRegistrationFormsRoutes,
  ...candidateRegistrationsRoutes,
  ...cronRoutes,
  ...electionCampaignsRoutes,
  ...electionsRoutes,
  ...faqRoutes,
  ...groupsRoutes,
  ...petitionCommentsRoutes,
  ...protocolsRoutes,
  ...statsRoutes,
  ...systemRoutes,
  ...teamInvitesRoutes,
  ...usersRoutes,
];
