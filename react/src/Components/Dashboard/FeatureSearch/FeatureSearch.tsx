import React, {
    MutableRefObject,
    RefObject,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';
import styled from 'styled-components';
import { fetchFeatures, fetchFeatureNames } from '../../../../api';
import useClickAway from '../../../hooks/useClickAway';
import { merge } from '../../../util';
import { TreeContext } from '../../Dashboard/Dashboard';
import { Input } from '../../Input';
import { Column } from '../../Layout';

const FeatureSearch: React.FC = () => {
    const [features, setFeatures] = useState<string[]>([]);
    const {
        displayContext: { opacityScale, visibleNodes },
        setDisplayContext,
    } = useContext(TreeContext);

    const getFeature = async (feature: string) => {
        console.log('fetching');
        const features = await fetchFeatures(feature);
        const featureMap: Record<string, number> = {};

        features.forEach(f => (featureMap[f.id] = f.value));

        visibleNodes?.eachAfter(n => {
            n.data.featureCount = n.data.items
                ? n.data.items.reduce<number>(
                      (acc, curr) =>
                          acc + featureMap[curr._barcode.unCell] || 0,
                      0
                  )
                : n.children!.reduce<number>(
                      (acc, curr) => acc + curr.data.featureCount!,
                      0
                  );
        });

        opacityScale?.domain([0, visibleNodes!.data.featureCount!]);

        setDisplayContext({ visibleNodes, opacityScale });

        console.log('parsed');
    };

    useEffect(() => {
        fetchFeatureNames().then(f => {
            setFeatures(f);
        });
    }, []);

    return <Autocomplete options={features} onSelect={getFeature} />;
};

interface AutocompleteProps {
    options: string[];
    onSelect: (feature: string) => void;
}

const Autocomplete: React.FC<AutocompleteProps> = ({ options, onSelect }) => {
    const [choices, setChoices] = useState<string[]>([]);
    const [choicesVisible, setChoicesVisible] = useState(false);
    const [search, setSearch] = useState('');

    const parentWidth = useRef<string>('0px');
    const inputRef =
        useRef<HTMLInputElement>() as MutableRefObject<HTMLInputElement>;
    const containerRef =
        useRef<HTMLDivElement>() as MutableRefObject<HTMLDivElement>;

    useClickAway(containerRef, () => setChoicesVisible(false));

    useEffect(() => {
        if (inputRef.current) {
            parentWidth.current = inputRef.current.clientWidth - 5 + 'px';
        }
    }, [inputRef.current]);

    useEffect(() => {
        setChoices(
            options.filter(o => o.startsWith(search.toLowerCase())).slice(0, 10)
        );
    }, [search, options]);

    return (
        <AutocompleteContainer ref={containerRef}>
            <Input
                ref={inputRef}
                value={search}
                onChange={e => setSearch(e.currentTarget.value)}
                onFocus={() => setChoicesVisible(true)}
            />
            <AutocompleteChoicesContainer wdth={parentWidth.current}>
                {choicesVisible &&
                    choices.map(c => (
                        <Choice
                            onClick={() => {
                                setChoicesVisible(false);
                                onSelect(c);
                                setSearch(c);
                            }}
                            key={c}
                        >
                            {c}
                        </Choice>
                    ))}
            </AutocompleteChoicesContainer>
        </AutocompleteContainer>
    );
};

const AutocompleteContainer = styled(Column)`
    position: relative;
`;

const AutocompleteChoicesContainer = styled(Column)<{ wdth: string }>`
    border-radius: 5px;
    position: absolute;
    top: 25px;
    width: ${props => props.wdth};
`;

const Choice = styled.span`
    background-color: ${props => props.theme.palette.primary};
    color: white;
    cursor: pointer;
    padding: 3px;
    width: 100%;
    &:hover {
        background-color: ${props => props.theme.palette.secondary};
    }
`;

export default FeatureSearch;
