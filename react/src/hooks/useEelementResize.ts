import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
/* https://usehooks-ts.com/react-hook/use-element-size */

interface Size {
    width: number;
    height: number;
}

const useElementResize = <T extends HTMLElement>() => {
    const [ref, setRef] = useState<T | null>(null);
    const [size, setSize] = useState<Size>({
        width: 0,
        height: 0,
    });

    const handleSize = useCallback(() => {
        setSize({
            width: ref?.offsetWidth || 0,
            height: ref?.offsetHeight || 0,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ref?.offsetHeight, ref?.offsetWidth]);

    useEffect(() => {
        if (ref) {
            window.addEventListener('resize', handleSize);
            return () => window.removeEventListener('resize', handleSize);
        }
    }, [ref, handleSize]);

    useLayoutEffect(() => {
        handleSize();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ref?.offsetHeight, ref?.offsetWidth]);

    return { setRef, ref, size };
};

export default useElementResize;
