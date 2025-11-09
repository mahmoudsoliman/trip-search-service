export interface User {
  id: string;
  auth0Sub: string;
  email?: string | null;
  name?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

