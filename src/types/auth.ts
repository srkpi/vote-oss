export interface User {
  userId: string;
  fullName: string;
  faculty: string;
  group: string;
  isAdmin: boolean;
  restrictedToFaculty: boolean;
  manageAdmins: boolean;
}
