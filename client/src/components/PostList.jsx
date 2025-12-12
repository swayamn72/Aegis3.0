import React from 'react';
import PostItem from './PostItem';
import { usePosts, useUpdatePost, useDeletePost } from '../hooks/useProfile';

const PostList = ({ playerId }) => {
    // Use React Query hooks
    const { data: posts, isLoading, error } = usePosts(playerId);
    const updatePostMutation = useUpdatePost();
    const deletePostMutation = useDeletePost();

    const handleEdit = (post) => {
        const newCaption = prompt('Edit your post caption:', post.caption);
        if (newCaption !== null && newCaption.trim()) {
            updatePostMutation.mutate(
                { postId: post._id, caption: newCaption },
                {
                    onError: () => {
                        alert('Failed to update post.');
                    }
                }
            );
        }
    };

    const handleDelete = (postId) => {
        if (window.confirm('Are you sure you want to delete this post?')) {
            deletePostMutation.mutate(postId, {
                onError: () => {
                    alert('Failed to delete post.');
                }
            });
        }
    };

    if (isLoading) {
        return <div className="text-center py-8 text-zinc-400">Loading posts...</div>;
    }

    if (error) {
        return <div className="text-center py-8 text-red-400">Error loading posts</div>;
    }

    if (!Array.isArray(posts) || posts.length === 0) {
        return <div className="text-center py-8 text-zinc-400">No posts to display.</div>;
    }

    return (
        <div className="max-w-2xl mx-auto px-4 py-6">
            {posts.map(post => (
                <PostItem
                    key={post._id}
                    post={post}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                />
            ))}
        </div>
    );
};

export default PostList;