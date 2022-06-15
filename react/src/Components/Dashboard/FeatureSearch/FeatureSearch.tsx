import React, {
    ForwardedRef,
    forwardRef,
    InputHTMLAttributes,
    KeyboardEvent,
    MutableRefObject,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { max, min, quantile, range, sum } from 'd3-array';
import { HierarchyPointNode } from 'd3-hierarchy';
import styled from 'styled-components';
import { fetchFeatures, fetchFeatureNames } from '../../../../api';
import useClickAway from '../../../hooks/useClickAway';
import {
    buildColorScale,
    getEntries,
    getMAD,
    getObjectIsEmpty,
    levenshtein,
} from '../../../util';
import Button from '../../Button';
import { TreeContext } from '../../Dashboard/Dashboard';
import { Input, NumberInput } from '../../Input';
import { Column, Row } from '../../Layout';
import Modal from '../../Modal';
import { Caption, Title } from '../../Typography';
import { CloseIcon } from '../../Icons';
import { AttributeMap, TMCNode } from '../../../types';
import { RadioButton, RadioGroup, RadioLabel } from '../../Radio';
import Checkbox from '../../Checkbox';

/**
 *
 * @param nodes
 * @param thresholds
 * @returns TMCNode: Note that the tree is mutated in place
 */

const updatefeatureStats = (
    nodes: HierarchyPointNode<TMCNode>,
    thresholds: Record<string, number>
) =>
    nodes.eachAfter(n => {
        // our featureStats, for the scale to read
        const hilo = {} as AttributeMap;

        //if these are leaves, store and calculate base values
        if (n.data.items) {
            n.data.items.forEach(cell => {
                //reduce cells for each node to hi/lows
                const key = getEntries(cell._barcode._featureCounts).reduce(
                    (acc, [k, v]) =>
                        `${acc ? acc + '-' : ''}${
                            v && v >= thresholds[k] ? 'high' : 'low'
                        }-${k}`,
                    ''
                );
                //add to node's running total of hilos
                if (key) {
                    hilo[key] = hilo[key]
                        ? { ...hilo[key], quantity: hilo[key].quantity + 1 }
                        : { scaleKey: key, quantity: 1 };
                }
            });
        } else {
            //if node is not a leaf, just add both children
            n.children!.map(node => node.data.featureCount).forEach(count => {
                for (const featurekey in count) {
                    if (!hilo[featurekey]) {
                        hilo[featurekey] = count[featurekey];
                    } else {
                        hilo[featurekey].quantity += count[featurekey].quantity;
                    }
                }
            });
        }
        n.data.featureCount = hilo;
        return n;
    });

interface FeatureStat {
    mad: number;
    madWithZeroes: number;
    max: number;
    median: number;
    medianWithZeroes: number;
    min: number;
    total: number;
}

const FeatureSearch: React.FC = () => {
    const [features, setFeatures] = useState<string[]>([]);
    const [featureStats, setfeatureStats] = useState<
        Record<string, FeatureStat>
    >({});
    const [loading, setLoading] = useState(false);
    const {
        displayContext: { expressionThresholds, visibleNodes },
        setDisplayContext,
    } = useContext(TreeContext);

    const resetOverlay = useCallback(() => {
        setDisplayContext({
            visibleNodes: visibleNodes?.each(n => (n.data.featureCount = {})),
        });
    }, [setDisplayContext]);

    const updateExpressionThresholds = useCallback(
        (feature: string, threshold: number) => {
            const newExpressionThresholds = {
                ...expressionThresholds!,
                [feature]: threshold,
            };

            updatefeatureStats(visibleNodes!, newExpressionThresholds);

            setDisplayContext({
                expressionThresholds: newExpressionThresholds,
                visibleNodes,
            });
        },
        [visibleNodes, expressionThresholds]
    );

    const removeFeature = (featureName: string) => {
        visibleNodes!.leaves().forEach(n =>
            n.data.items?.forEach(item => {
                if (
                    item._barcode?._featureCounts &&
                    item._barcode._featureCounts[featureName] !== undefined
                ) {
                    delete item._barcode._featureCounts[featureName];
                }
            })
        );

        const nodes = updatefeatureStats(visibleNodes!, expressionThresholds!);
        delete featureStats[featureName];
        delete expressionThresholds![featureName];
        //todo: drop threshold for this item and update display context
        setfeatureStats(featureStats);
        const { colorScale, colorScaleKey } = updateColorScale(nodes);
        setDisplayContext({ colorScale, colorScaleKey, expressionThresholds });
    };

    const updateColorScale = (visibleNodes: HierarchyPointNode<TMCNode>) => {
        //if we removed last feature, reset to regular color scale

        const colorScaleKey = (
            Object.values(visibleNodes.data.featureCount).length
                ? 'featureCount'
                : 'labelCount'
        ) as 'featureCount' | 'labelCount';

        const colorScale = buildColorScale(colorScaleKey, visibleNodes);

        return { colorScale, colorScaleKey };
    };

    const getFeature = async (feature: string) => {
        if (visibleNodes) {
            setLoading(true);
            const features = await fetchFeatures(feature);
            const featureMap: Record<string, number> = {};
            const range: number[] = [];

            features.forEach(f => {
                featureMap[f.id] = f.value;
            });

            visibleNodes.leaves().forEach(n => {
                if (n.data.items) {
                    n.data.items = n.data.items.map(cell => {
                        //add the new feature to cell-level raw feature counts
                        const fcounts = cell._barcode._featureCounts || {};
                        fcounts[feature] =
                            featureMap[cell._barcode.unCell] || 0;
                        cell._barcode._featureCounts = fcounts;
                        range.push(fcounts[feature] as number);
                        return cell;
                    });
                }
            });

            const median = quantile(range.filter(Boolean), 0.5);
            const medianWithZeroes = quantile(range, 0.5);

            //for local GUI display
            setfeatureStats({
                ...featureStats,
                [feature]: {
                    mad: getMAD(range.filter(Boolean)) || 0, //remove 0s
                    madWithZeroes: getMAD(range) || 0, //remove 0s
                    max: max(range) || 0,
                    min: min(range) || 0,
                    median: median || 0,
                    medianWithZeroes: medianWithZeroes || 0,
                    total: sum(range) || 0,
                },
            });

            const newExpressionThresholds = {
                ...expressionThresholds,
                [feature]: median || 0,
            };

            const withExpression = updatefeatureStats(
                visibleNodes,
                newExpressionThresholds
            );

            const { colorScale, colorScaleKey } =
                updateColorScale(withExpression);

            setDisplayContext({
                colorScale,
                colorScaleKey,
                expressionThresholds: newExpressionThresholds,
            });

            setLoading(false);
        }
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

            {!!visibleNodes &&
                !getObjectIsEmpty(visibleNodes.data.featureCount) && (
                    <>
                        <FeatureListContainer>
                            <FeatureListLabel>
                                Selected Features
                            </FeatureListLabel>
                            <FeatureList>
                                {getEntries(expressionThresholds).map(
                                    ([k, v]) => (
                                        <FeatureSlider
                                            key={k}
                                            featureName={k}
                                            featureStats={featureStats[k]}
                                            highLowThreshold={v}
                                            removeFeature={removeFeature}
                                            updateThreshold={updateExpressionThresholds.bind(
                                                null,
                                                k
                                            )}
                                        />
                                    )
                                )}
                            </FeatureList>
                        </FeatureListContainer>
                    </>
                )}

            <Modal open={loading} message="Loading..." />
        </Column>
    );
};

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

interface FeatureSliderProps {
    featureName: string;
    featureStats: FeatureStat;
    highLowThreshold: number;
    removeFeature: (featureName: string) => void;
    updateThreshold: (newThreshold: number) => void;
}

const FeatureSlider: React.FC<FeatureSliderProps> = ({
    featureName,
    featureStats,
    highLowThreshold,
    removeFeature,
    updateThreshold,
}) => {
    const [rangeType, setRangeType] = useState<'mad' | 'raw'>('raw');
    const [includeZeroes, setIncludeZeroes] = useState(false);

    const {
        mad: _mad,
        madWithZeroes,
        max,
        median: _median,
        medianWithZeroes,
    } = featureStats;

    const mad = useMemo(() => {
        return includeZeroes ? madWithZeroes : _mad;
    }, [includeZeroes, madWithZeroes, _mad]);

    const median = useMemo(() => {
        return includeZeroes ? medianWithZeroes : _median;
    }, [includeZeroes, madWithZeroes, _median]);

    const madRange = useMemo(() => {
        if (mad !== undefined) {
            return range(median, max, mad);
        } else {
            return [];
        }
    }, [featureStats, includeZeroes]);

    return (
        <Column>
            <Row margin="2px">
                <FeaturePill
                    count={featureStats.total.toString()}
                    name={featureName}
                    removeFeature={removeFeature}
                />
            </Row>
            <Row margin="2px">High/Low Threshold: {highLowThreshold}</Row>
            {rangeType === 'mad' && (
                <Row alignItems="center" margin="2px">
                    MAD: {mad}
                    {rangeType === 'mad' && (
                        <Checkbox
                            checked={includeZeroes}
                            label="Include Zeroes"
                            onClick={() => setIncludeZeroes(!includeZeroes)}
                            style={{ marginLeft: '5px' }}
                        />
                    )}
                </Row>
            )}
            <Row alignItems="center" margin="2px">
                <RadioGroup>
                    <RadioButton
                        checked={rangeType === 'raw'}
                        id="rawRange"
                        name="rawRange"
                        onChange={() => setRangeType('raw')}
                        type="radio"
                    />
                    <RadioLabel htmlFor="rawRange">Raw</RadioLabel>
                    <RadioButton
                        checked={rangeType === 'mad'}
                        id="madRange"
                        name="madRange"
                        onChange={() => setRangeType('mad')}
                        type="radio"
                    />
                    <RadioLabel htmlFor="madRange">MAD</RadioLabel>
                </RadioGroup>
            </Row>
            <Row alignItems="center" margin="2px">
                <span>{rangeType === 'raw' ? featureStats.min : 0}</span>
                <input
                    type="range"
                    max={
                        rangeType === 'raw'
                            ? featureStats.max
                            : madRange?.length
                    }
                    min={rangeType === 'raw' ? featureStats.min : 0}
                    step={1}
                    value={
                        rangeType === 'raw'
                            ? highLowThreshold
                            : highLowThreshold / mad - median
                    }
                    onChange={v =>
                        updateThreshold(
                            rangeType === 'raw'
                                ? +v.currentTarget.value
                                : median + +v.currentTarget.value * mad
                        )
                    }
                />
                <span>
                    {rangeType === 'raw' ? featureStats.max : madRange?.length}
                </span>
                <NumberInput
                    onChange={v =>
                        updateThreshold(
                            rangeType === 'raw' ? +v : median + +v * mad
                        )
                    }
                    style={{ marginLeft: '3px' }}
                    value={
                        rangeType === 'raw'
                            ? highLowThreshold
                            : (highLowThreshold - median) / mad
                    }
                />
            </Row>
        </Column>
    );
};

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
    const [minVisibleIdx, setMinVisibleIdx] = useState(0);
    const [search, setSearch] = useState('');
    const [selectedIdx, setSelectedIdx] = useState<number>(0);

    const maxVisible = useMemo(() => 10, []);

    const parentWidth = useRef<string>('0px');
    const inputRef =
        useRef<HTMLInputElement>() as MutableRefObject<HTMLInputElement>;
    const containerRef =
        useRef<HTMLDivElement>() as MutableRefObject<HTMLDivElement>;

    useClickAway(containerRef, () => setChoicesVisible(false));

    /* Adjust the visible choices */
    useEffect(() => {
        if (choices.length) {
            if (selectedIdx - maxVisible === minVisibleIdx) {
                if (selectedIdx === options.length) {
                    setMinVisibleIdx(0);
                } else {
                    setMinVisibleIdx(minVisibleIdx + 1);
                }
            } else if (selectedIdx < minVisibleIdx) {
                if (selectedIdx === 0) {
                    setMinVisibleIdx(0);
                } else {
                    setMinVisibleIdx(minVisibleIdx - 1);
                }
            }
        }
    }, [selectedIdx]);

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
        );
        setSelectedIdx(0);
    }, [options, search]);

    const resetInputs = () => {
        setChoices([]);
        setSearch('');
        setChoicesVisible(false);
        setMinVisibleIdx(0);
        setSelectedIdx(0);
    };

    const _resetOverlay = () => {
        resetOverlay();
        resetInputs();
    };

    const select = (choice: string) => {
        onSelect(choice);
        resetInputs();
    };

    const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.code === 'ArrowUp') {
            const nextIdx = selectedIdx === 0 ? 0 : selectedIdx - 1;
            return setSelectedIdx(nextIdx);
        } else if (e.code === 'ArrowDown') {
            const nextIdx = (selectedIdx + 1) % options.length;
            return setSelectedIdx(nextIdx);
        } else if (e.code === 'Escape') {
            resetInputs();
        } else if (e.code === 'Enter') {
            if (selectedIdx > -1) {
                select(choices[selectedIdx]);
            }
        }
    };

    const getIsSelected = (idx: number) => {
        const isSelected = minVisibleIdx + idx === selectedIdx;
        return isSelected;
    };

    return (
        <Row alignItems="center" margin="0px" style={{ marginTop: '5px' }}>
            <AutocompleteContainer width="auto" ref={containerRef}>
                <AutocompleteInput
                    ref={inputRef}
                    handleKeyPress={handleKeyPress}
                    onChange={e => {
                        setSearch(e.currentTarget.value);
                        setChoicesVisible(true);
                    }}
                    onClick={() => setChoicesVisible(true)}
                    value={search}
                />
                <AutocompleteChoicesContainer _width={parentWidth.current}>
                    {choicesVisible &&
                        choices
                            .slice(minVisibleIdx, minVisibleIdx + maxVisible)
                            .map((c, i) => (
                                <Choice
                                    onClick={() => select(c)}
                                    selected={getIsSelected(i)}
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
