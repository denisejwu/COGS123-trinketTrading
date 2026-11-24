import Link from "next/link";
import { MessagesSquare, Trash2 } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { deletePost } from "./actions";
import { PostForm } from "./PostForm";

type Post = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  parent_id: string | null;
  author: { username: string; display_name: string; avatar_path: string | null };
};

const POST_SELECT =
  "id, body, created_at, author_id, parent_id, author:profiles!community_posts_author_id_fkey ( username, display_name, avatar_path )";

/** The Discussion tab: newest threads first, each with its replies. */
export async function Discussion({
  communityId,
  communitySlug,
  isMember,
  myId,
}: {
  communityId: string;
  communitySlug: string;
  isMember: boolean;
  myId: string;
}) {
  const supabase = await createClient();

  // 1. The 30 newest threads (posts with no parent).
  const { data: threadData, error } = await supabase
    .from("community_posts")
    .select(POST_SELECT)
    .eq("community_id", communityId)
    .is("parent_id", null)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(`Couldn't load the discussion: ${error.message}`);
  const threads = (threadData ?? []) as unknown as Post[];

  // 2. All replies to those threads, oldest first.
  const { data: replyData } = threads.length
    ? await supabase
        .from("community_posts")
        .select(POST_SELECT)
        .in("parent_id", threads.map((t) => t.id))
        .order("created_at", { ascending: true })
    : { data: [] };
  const replies = (replyData ?? []) as unknown as Post[];

  return (
    <div className="space-y-5">
      {isMember ? (
        <div className="rounded-3xl border border-line bg-card p-4">
          <PostForm
            communityId={communityId}
            communitySlug={communitySlug}
            label="Start a conversation"
            placeholder="Ask a question, share your wishlist, or plan a meetup…"
            submitLabel="Post"
          />
        </div>
      ) : (
        <Notice tone="info">Join this community to start conversations and reply.</Notice>
      )}

      {threads.length === 0 ? (
        <EmptyState icon={<MessagesSquare size={22} />} title="No conversations yet">
          {isMember ? "Say hi and start the first one!" : "Join and start the first one!"}
        </EmptyState>
      ) : (
        <ul className="space-y-4">
          {threads.map((thread) => {
            const threadReplies = replies.filter((r) => r.parent_id === thread.id);
            return (
              <li key={thread.id} className="rounded-3xl border border-line bg-card p-4">
                <PostItem post={thread} myId={myId} communitySlug={communitySlug} />

                {threadReplies.length > 0 && (
                  <ul className="mt-3 space-y-3 border-l-2 border-line pl-4" aria-label="Replies">
                    {threadReplies.map((reply) => (
                      <li key={reply.id}>
                        <PostItem post={reply} myId={myId} communitySlug={communitySlug} small />
                      </li>
                    ))}
                  </ul>
                )}

                {isMember && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-bold text-accent">Reply</summary>
                    <div className="mt-2">
                      <PostForm
                        communityId={communityId}
                        communitySlug={communitySlug}
                        parentId={thread.id}
                        label="Your reply"
                        placeholder="Write a reply…"
                        submitLabel="Reply"
                      />
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PostItem({
  post,
  myId,
  communitySlug,
  small = false,
}: {
  post: Post;
  myId: string;
  communitySlug: string;
  small?: boolean;
}) {
  return (
    <article className="flex gap-3">
      <Avatar path={post.author.avatar_path} name={post.author.display_name} size={small ? 28 : 36} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <Link href={`/u/${post.author.username}`} className="font-bold hover:underline">
            {post.author.display_name}
          </Link>
          <span className="text-xs text-muted">
            <time dateTime={post.created_at}>{timeAgo(post.created_at)}</time>
          </span>
        </div>
        <p className="mt-0.5 whitespace-pre-line break-words">{post.body}</p>
      </div>
      {post.author_id === myId && (
        <form action={deletePost}>
          <input type="hidden" name="post_id" value={post.id} />
          <input type="hidden" name="slug" value={communitySlug} />
          <button
            type="submit"
            aria-label="Delete this post"
            className="rounded-full p-1.5 text-muted hover:bg-danger-soft hover:text-danger"
          >
            <Trash2 aria-hidden="true" size={16} />
          </button>
        </form>
      )}
    </article>
  );
}
