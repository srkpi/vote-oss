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
