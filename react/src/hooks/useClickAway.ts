//https://github.com/streamich/react-use/blob/master/src/useClickAway.ts

import { RefObject, useEffect, useRef } from 'react';

const useClickAway = <E extends Event = Event>(
    ref: RefObject<HTMLElement | null>,
    onClickAway: (event: E) => void
) => {
    const events = ['mousedown', 'touchstart'];
    const savedCallback = useRef(onClickAway);
    useEffect(() => {
        savedCallback.current = onClickAway;
    }, [onClickAway]);
    useEffect(() => {
        const handler = (event: any) => {
            const { current: el } = ref;
            el && !el.contains(event.target) && savedCallback.current(event);
        };
        for (const eventName of events) {
            document.addEventListener(eventName, handler);
        }
        return () => {
            for (const eventName of events) {
                document.removeEventListener(eventName, handler);
            }
        };
    }, [events, ref]);
};

export default useClickAway;
