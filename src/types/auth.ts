import type { Admin } from '@prisma/client';

import type { StudyFormValue, StudyYearValue } from '@/lib/constants';

export interface KpiIdUserInfo {
  EMPLOYEE_ID: string;
  AUTH_METHOD: string;
  STUDENT_ID: string;
  TAX_ID: string;
  NAME: string;
  TRACE_ID: string;
  TIME_STAMP: string;
}

export interface CampusUserInfo {
  groupName: string;
  faculty: string;
  status: 'Studying' | 'Dismissed';
  studyForm: StudyFormValue;
  studyYear: StudyYearValue;
  speciality: string;
}

export interface TicketUserInfo {
  id: string;
  created: string;
  applicationId: string;
  data: KpiIdUserInfo;
  traceId: string;
}

export interface DiiaKpiIdResponse {
  deepLink: string;
  pageLink: string;
  requestId: string;
  createdAt: string;
}

export interface DiiaInitResponse {
  deepLink: string;
  requestId: string;
  qrCode: string;
  expiresAt: string;
}

export interface TokenPayload {
  sub: string;
  faculty: string;
  group: string;
  fullName: string;
  speciality?: string;
  studyYear?: number;
  studyForm?: string;
  isAdmin?: boolean;
  restrictedToFaculty?: boolean;
  manageAdmins?: boolean;
}

export interface VerifiedPayload extends TokenPayload {
  jti: string;
  iat: number;
  tokenType: 'access' | 'refresh';
}

export interface UserInfo {
  userId: string;
  fullName: string;
  faculty: string;
  group: string;
  speciality?: string;
  studyYear?: number;
  studyForm?: string;
}

export interface User {
  userId: string;
  fullName: string;
  faculty: string;
  group: string;
  speciality?: string;
  studyYear?: number;
  studyForm?: string;
  isAdmin: boolean;
  restrictedToFaculty: boolean;
  manageAdmins: boolean;
}

export type AuthFailure = {
  ok: false;
  error: string;
  status: 401 | 403;
};

export type AuthSuccess = {
  ok: true;
  user: VerifiedPayload;
};

export type AuthAdminSuccess = {
  ok: true;
  user: VerifiedPayload;
  admin: Admin;
};
