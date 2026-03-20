export interface TicketUserInfo {
  id: string;
  created: string;
  applicationId: string;
  data: {
    EMPLOYEE_ID: string;
    AUTH_METHOD: string;
    STUDENT_ID: string;
    TAX_ID: string;
    NAME: string;
    TRACE_ID: string;
    TIME_STAMP: string;
  };
  traceId: string;
}

export interface TokenPayload {
  sub: string;
  faculty: string;
  group: string;
  fullName: string;
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
}

export interface User {
  userId: string;
  fullName: string;
  faculty: string;
  group: string;
  isAdmin: boolean;
  restrictedToFaculty: boolean;
  manageAdmins: boolean;
}
