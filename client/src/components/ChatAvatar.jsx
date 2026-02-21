import { useState, useEffect } from 'react';

/**
 * Flicker-free avatar component.
 * Shows a dark placeholder while loading, swaps to fallback on error.
 * Never shows a broken image icon.
 */
const ChatAvatar = ({ src, fallbackSeed, alt, className }) => {
    const fallbackUrl = `https://api.dicebear.com/7.x/avatars/svg?seed=${fallbackSeed || 'default'}`;

    // Determine initial src: skip broken/empty values immediately
    const isValidSrc = src && typeof src === 'string' && src.trim() !== '';
    const [imgSrc, setImgSrc] = useState(isValidSrc ? src : fallbackUrl);
    const [loaded, setLoaded] = useState(false);

    // Reset state when src prop changes
    useEffect(() => {
        const valid = src && typeof src === 'string' && src.trim() !== '';
        setImgSrc(valid ? src : fallbackUrl);
        setLoaded(false);
    }, [src, fallbackUrl]);

    return (
        <div
            className={className}
            style={{
                backgroundColor: '#3f3f46', // zinc-700 placeholder
                overflow: 'hidden',
                position: 'relative',
                flexShrink: 0,
            }}
        >
            <img
                src={imgSrc}
                alt={alt || ''}
                onLoad={() => setLoaded(true)}
                onError={() => {
                    if (imgSrc !== fallbackUrl) {
                        setImgSrc(fallbackUrl);
                        setLoaded(false);
                    } else {
                        // Even fallback failed, just show bg
                        setLoaded(false);
                    }
                }}
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: loaded ? 1 : 0,
                    transition: 'opacity 0.15s ease-in',
                    display: 'block',
                }}
            />
        </div>
    );
};

export default ChatAvatar;
