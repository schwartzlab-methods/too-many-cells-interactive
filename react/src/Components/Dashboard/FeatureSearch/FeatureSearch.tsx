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
import { HierarchyPointNode } from 'd3-hierarchy';
import { scaleLinear } from 'd3-scale';
import styled from 'styled-components';
import { fetchFeatures, fetchFeatureNames } from '../../../../api';
import useClickAway from '../../../hooks/useClickAway';
import {
    getAverageFeatureCount,
    getEntries,
    getObjectIsEmpty,
    levenshtein,
} from '../../../util';
import Button from '../../Button';
import { TreeContext } from '../../Dashboard/Dashboard';
import { Input } from '../../Input';
import { Column, Row } from '../../Layout';
import Modal from '../../Modal';
import { Caption, Title } from '../../Typography';
import { CloseIcon } from '../../Icons';
import { TMCNode } from '../../../types';

const FeatureSearch: React.FC = () => {
    const [features, setFeatures] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const {
        displayContext: { opacityScale, visibleNodes },
        setDisplayContext,
    } = useContext(TreeContext);

    const resetOverlay = useCallback(() => {
        setDisplayContext({
            opacityScale: scaleLinear([0, 1]).domain([0, 1]),
            visibleNodes: visibleNodes?.each(n => (n.data.featureCount = {})),
        });
    }, [setDisplayContext]);

    const removeFeature = (featureName: string) => {
        visibleNodes?.each(n => delete n.data.featureCount[featureName]);
        updateOpacityScale(visibleNodes!);
    };

    const updateOpacityScale = (visibleNodes: HierarchyPointNode<TMCNode>) => {
        opacityScale?.domain([
            0,
            getAverageFeatureCount(visibleNodes.data.featureCount),
        ]);

        setDisplayContext({ visibleNodes, opacityScale });
    };

    const getFeature = async (feature: string) => {
        setLoading(true);
        const features = await fetchFeatures(feature);
        const featureMap: Record<string, number> = {};

        features.forEach(f => (featureMap[f.id] = f.value));

        visibleNodes?.eachAfter(n => {
            n.data.featureCount = {
                ...n.data.featureCount,
                [feature]: n.data.items
                    ? // if leaf, reduce all items
                      n.data.items.reduce<number>(
                          (acc, curr) =>
                              acc + featureMap[curr._barcode.unCell] || 0,
                          0
                      )
                    : // otherwise just combine children
                      n.children!.reduce<number>(
                          (acc, curr) => acc + curr.data.featureCount[feature],
                          0
                      ),
            };
        });

        updateOpacityScale(visibleNodes!);

        // root will always have highest counts

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
            <Caption>Search for a feature by identifier</Caption>
            <Autocomplete
                resetOverlay={resetOverlay}
                options={features}
                onSelect={getFeature}
            />
            <Row margin="5px 0px" alignItems="center">
                {!!opacityScale &&
                    !getObjectIsEmpty(visibleNodes!.data.featureCount) && (
                        <>
                            <ScaleItem>{opacityScale.domain()[0]}</ScaleItem>
                            <ScaleItem>
                                <svg
                                    width="100%"
                                    height="25px"
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 10 1"
                                >
                                    <defs>
                                        <linearGradient id="scaleGradient">
                                            <stop
                                                offset="5%"
                                                stopColor="rgba(0,0,0,0)"
                                            />
                                            <stop
                                                offset="95%"
                                                stopColor="rgba(0,0,0,1)"
                                            />
                                        </linearGradient>
                                    </defs>
                                    <rect
                                        fill="url('#scaleGradient')"
                                        width={10}
                                        height={1}
                                    />
                                </svg>
                            </ScaleItem>
                            <ScaleItem>
                                {Number(
                                    opacityScale.domain()[1]
                                ).toLocaleString()}
                            </ScaleItem>
                        </>
                    )}
            </Row>

            {!!visibleNodes &&
                !getObjectIsEmpty(visibleNodes.data.featureCount) && (
                    <FeatureListContainer>
                        <FeatureListLabel>Selected Features</FeatureListLabel>
                        <FeatureList>
                            {getEntries(visibleNodes.data.featureCount).map(
                                ([k, v]) => (
                                    <FeaturePill
                                        count={v.toLocaleString()}
                                        key={k}
                                        name={k}
                                        removeFeature={removeFeature}
                                    />
                                )
                            )}
                        </FeatureList>
                    </FeatureListContainer>
                )}
            <Modal open={loading} message="Loading..." />
        </Column>
    );
};

const ScaleItem = styled.div`
    margin: 0px 5px;
`;

const SearchTitle = styled(Title)`
    margin: 0px;
`;

const FeatureListContainer = styled(Column)`
    position: relative;
    margin: 0px 0px;
`;

const FeatureList = styled(Row)`
    border: thin black solid;
    border-radius: 3px;
    flex-wrap: wrap;
    padding: 8px;
    margin: 5px 0px;
`;

const FeatureListLabel = styled(Caption)`
    background-color: white;
    position: absolute;
`;

interface FeaturePillProps {
    count: string;
    name: string;
    removeFeature: (featureName: string) => void;
}

const FeaturePill: React.FC<FeaturePillProps> = ({
    removeFeature,
    name,
    count,
}) => (
    <FeaturePillContainer>
        {name}: {count}
        <RemoveFeatureIcon
            onClick={removeFeature.bind(null, name)}
            strokeWidth={10}
            pointer
            stroke="white"
            size="7px"
        />
    </FeaturePillContainer>
);

const RemoveFeatureIcon = styled(CloseIcon)`
    padding: 3px;
`;

const FeaturePillContainer = styled.span`
    align-items: flex-start;
    background-color: ${props => props.theme.palette.primary};
    border-radius: 7px;
    color: white;
    display: flex;
    margin: 3px;
    padding: 4px;
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
            options
                .map(o => ({
                    word: o,
                    distance: levenshtein(
                        o.toLowerCase(),
                        search.toLowerCase()
                    ),
                }))
                .sort((a, b) => (a.distance < b.distance ? -1 : 1))
                .map(d => d.word)
                .slice(0, 10)
        );
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
                                    resetInputs();
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
        return <Input {...rest} ref={ref} onKeyDownCapture={handleKeyPress} />;
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
    z-index: 10;
`;

export default FeatureSearch;
