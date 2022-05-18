import { scaleLinear } from 'd3-scale';
import React, {
    ForwardedRef,
    forwardRef,
    InputHTMLAttributes,
    KeyboardEvent,
    MutableRefObject,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';
import styled from 'styled-components';
import { fetchFeatures, fetchFeatureNames } from '../../../../api';
import useClickAway from '../../../hooks/useClickAway';
import Button from '../../Button';
import { TreeContext } from '../../Dashboard/Dashboard';
import { Input } from '../../Input';
import { Column, Row } from '../../Layout';
import Modal from '../../Modal';
import { Caption, Title } from '../../Typography';

const FeatureSearch: React.FC = () => {
    const [features, setFeatures] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const {
        displayContext: { opacityScale, visibleNodes },
        setDisplayContext,
    } = useContext(TreeContext);

    const resetOverlay = useCallback(() => {
        setDisplayContext({ opacityScale: scaleLinear([0, 1]).domain([0, 1]) });
    }, [setDisplayContext]);

    const getFeature = async (feature: string) => {
        setLoading(true);
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

        setLoading(false);
    };

    useEffect(() => {
        fetchFeatureNames().then(f => {
            setFeatures(f);
        });
    }, []);

    return (
        <Column>
            <SearchTitle>Feature Search</SearchTitle>
            <Caption>Type a feature name into the box to search</Caption>
            <Autocomplete
                resetOverlay={resetOverlay}
                options={features}
                onSelect={getFeature}
            />
            <Modal open={loading} message="Loading..." />
        </Column>
    );
};

const SearchTitle = styled(Title)`
    margin: 0px;
`;

interface AutocompleteProps {
    options: string[];
    onSelect: (feature: string) => void;
    resetOverlay: () => void;
}

const Autocomplete: React.FC<AutocompleteProps> = ({
    options,
    onSelect,
    resetOverlay,
}) => {
    const [choices, setChoices] = useState<string[]>([]);
    const [choicesVisible, setChoicesVisible] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedIdx, setSelectedIdx] = useState<number>(-1);

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
        if (search && !choicesVisible) {
            setChoicesVisible(true);
        }
        setSelectedIdx(-1);
    }, [search, options]);

    const resetInputs = () => {
        setChoices([]);
        setSearch('');
        setChoicesVisible(false);
    };

    const _resetOverlay = () => {
        resetOverlay();
        resetInputs();
    };

    const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
        switch (e.code) {
            case 'ArrowUp':
                setSelectedIdx(
                    selectedIdx <= 0 ? choices.length - 1 : selectedIdx - 1
                );
                break;
            case 'ArrowDown':
                setSelectedIdx((selectedIdx + 1) % choices.length);
                break;

            case 'Escape':
                resetInputs();
                break;

            case 'Enter':
                if (selectedIdx > -1) {
                    setSearch(choices[selectedIdx]);
                    onSelect(choices[selectedIdx]);
                    setChoicesVisible(false);
                }
                break;
        }
    };

    return (
        <Row alignItems="center" margin="0px" style={{ marginTop: '5px' }}>
            <AutocompleteContainer width="auto" ref={containerRef}>
                <AutocompleteInput
                    ref={inputRef}
                    handleKeyPress={handleKeyPress}
                    onChange={e => setSearch(e.currentTarget.value)}
                    onFocus={() => setChoicesVisible(true)}
                    value={search}
                />
                <AutocompleteChoicesContainer _width={parentWidth.current}>
                    {choicesVisible &&
                        choices.map((c, i) => (
                            <Choice
                                onClick={() => {
                                    setChoicesVisible(false);
                                    onSelect(c);
                                    setSearch(c);
                                }}
                                selected={selectedIdx === i}
                                key={c}
                            >
                                {c}
                            </Choice>
                        ))}
                </AutocompleteChoicesContainer>
            </AutocompleteContainer>
            <Button onClick={_resetOverlay}>Reset</Button>
        </Row>
    );
};

interface AutocompleteInputProps extends InputHTMLAttributes<any> {
    handleKeyPress: (e: KeyboardEvent<HTMLInputElement>) => void;
    ref: React.Ref<HTMLInputElement>;
}

const AutocompleteInput: React.FC<AutocompleteInputProps> = forwardRef(
    (props: AutocompleteInputProps, ref: ForwardedRef<HTMLInputElement>) => {
        const { handleKeyPress, ...rest } = props;
        return <Input {...rest} ref={ref} onKeyUp={handleKeyPress} />;
    }
);

AutocompleteInput.displayName = 'Autocomplete Input';

const AutocompleteContainer = styled(Column)`
    flex-grow: 0;
    margin-right: 5px;
    position: relative;
`;

const AutocompleteChoicesContainer = styled(Column)<{ _width: string }>`
    border-radius: 5px;
    position: absolute;
    top: 25px;
    width: ${props => props._width};
`;

const Choice = styled.span<{ selected: boolean }>`
    background-color: ${props =>
        props.selected
            ? props.theme.palette.secondary
            : props.theme.palette.primary};
    color: white;
    cursor: pointer;
    padding: 3px;
    width: 100%;
    &:hover {
        background-color: ${props => props.theme.palette.secondary};
    }
`;

export default FeatureSearch;
