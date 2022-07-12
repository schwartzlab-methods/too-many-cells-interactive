/* adapted from https://github.com/mui/material-ui/blob/master/packages/mui-material/src/useMediaQuery/useMediaQuery.ts */
import { useEffect, useState } from 'react';

const useMediaQuery = (query: string, def = false): boolean => {
    const [match, setMatch] = useState(() => def);

    useEffect(() => {
        const queryList = matchMedia(query);
        const updateMatch = () => setMatch(queryList.matches);
        updateMatch();
        queryList.addEventListener('change', updateMatch);
        return () => queryList.removeEventListener('change', updateMatch);
    }, [query]);

    return match;
};

export default useMediaQuery;
