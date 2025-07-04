// types/comment.types.ts
import type { Comment as CommentType } from "../models/comment.model";
export type Comment = CommentType;

export interface NewComment {
  videoId: number;
  text: string;
}
