import { computed } from 'vue';
import type { Post } from '../archive/model';
import { dbVersion, getAllPosts, getDisplayPost } from '../lib/db-service';

/** Captured posts newest first; pure reposts are listed through the original they point to. */
export const capturedPosts = computed<Post[]>(() => {
  void dbVersion.value;
  const seen = new Set<string>();
  return getAllPosts()
    .map(getDisplayPost)
    .filter((post) => !seen.has(post.id) && seen.add(post.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
});
