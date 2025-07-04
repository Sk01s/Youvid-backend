import type { Channel as ChannelType } from "./../models/channel.model";
export type Channel = ChannelType;

export interface NewChannel {
  userId: number;
  name: string;
  avatar?: string;
  subscribers?: number;
  verified?: boolean;
}
