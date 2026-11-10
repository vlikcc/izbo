import { useEffect } from 'react';

const DEFAULT_TITLE = 'YZ Kampüs';

/**
 * Sets the document title and the description index.html already carries, and puts them back when the page
 * goes away. Updating the existing tag (instead of rendering a second <meta>) keeps exactly one description
 * for crawlers.
 */
export function usePageMeta(title: string, description?: string) {
    useEffect(() => {
        const previousTitle = document.title;
        document.title = title || DEFAULT_TITLE;

        const tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
        const previousDescription = tag?.content;
        if (tag && description) tag.content = description;

        return () => {
            document.title = previousTitle;
            if (tag && previousDescription !== undefined) tag.content = previousDescription;
        };
    }, [title, description]);
}
