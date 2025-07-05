// types/auth.types.ts
import type { User as UserType } from "../models/user.model";

export type UserProfile = UserType;

export interface AuthResult<T> {
  user: T;
  token: string;
}
