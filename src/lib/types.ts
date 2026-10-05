import type { Media, Post, User } from '../archive/model';

export type { Media, Post, User } from '../archive/model';

/** Records collected from one X response. */
export interface ParsedResponse {
  users: Map<string, User>;
  posts: Map<string, Post>;
  media: Map<string, Media>;
  meta: {
    instructionPath: string | null;
    warnings: string[];
  };
}
