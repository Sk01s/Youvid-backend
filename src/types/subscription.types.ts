// types/subscription.types.ts
import type { Subscription as SubscriptionType } from "../models/subscription.model";
export type Subscription = SubscriptionType;

export interface SubscriptionStatus {
  isSubscribed: boolean;
}
