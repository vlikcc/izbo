import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const saveProgress = vi.fn().mockResolvedValue({ positionSeconds: 0, completed: false, updatedAt: '' });
const loadSource = vi.fn();

vi.mock('hls.js', () => {
    class FakeHls {
        static isSupported() { return true; }
        static Events = { MANIFEST_PARSED: 'manifestParsed', ERROR: 'hlsError' };
        static ErrorTypes = { NETWORK_ERROR: 'networkError' };
        on() {}
        loadSource(src: string) { loadSource(src); }
        attachMedia() {}
        startLoad() {}
        destroy() {}
    }
    return { default: FakeHls };
});

vi.mock('../../services/content.service', () => ({
    default: {
        hlsUrl: (id: string) => `http://api.test/api/content/items/${id}/hls/master.m3u8`,
        saveProgress: (...args: unknown[]) => saveProgress(...args),
        getItem: vi.fn(),
    },
}));

import { VideoPlayer } from './VideoPlayer';

function videoAt(container: HTMLElement, seconds: number) {
    const video = container.querySelector('video')!;
    Object.defineProperty(video, 'currentTime', { value: seconds, configurable: true, writable: true });
    return video;
}

describe('VideoPlayer', () => {
    beforeEach(() => {
        saveProgress.mockClear();
        loadSource.mockClear();
    });

    it('loads the item playlist through hls.js', () => {
        render(<VideoPlayer itemId="abc" />);
        expect(loadSource).toHaveBeenCalledWith('http://api.test/api/content/items/abc/hls/master.m3u8');
    });

    it('records the position when the learner pauses, and completion when the video ends', async () => {
        const { container } = render(<VideoPlayer itemId="abc" />);

        videoAt(container, 125).dispatchEvent(new Event('pause'));
        await waitFor(() => expect(saveProgress).toHaveBeenCalledWith('abc', 125, false));

        videoAt(container, 600).dispatchEvent(new Event('ended'));
        await waitFor(() => expect(saveProgress).toHaveBeenCalledWith('abc', 600, true));
    });

    it('does not record anything for previews', () => {
        const { container, unmount } = render(<VideoPlayer itemId="abc" trackProgress={false} />);

        videoAt(container, 125).dispatchEvent(new Event('pause'));
        unmount();

        expect(saveProgress).not.toHaveBeenCalled();
    });
});
