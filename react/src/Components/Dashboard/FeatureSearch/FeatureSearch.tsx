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
import { max, min, quantile, sum } from 'd3-array';
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
import { Input } from '../../Input';
import { Column, Row } from '../../Layout';
import Modal from '../../Modal';
import { Caption, Label, Title } from '../../Typography';
import { CloseIcon } from '../../Icons';
import { AttributeMap, TMCNode } from '../../../types';

/* assumes all cells are up to date with expression values  */
const calculateExpressionValues = (
    nodes: HierarchyPointNode<TMCNode>,
    thresholds: Record<string, number>
) => {
    return nodes.eachAfter(n => {
        // our featureCounts, for the scale to read
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
            //if node is not a leaf, sum feature counts in leaves and divide by leaf count for
            //average expression per node in subtree
            n.leaves()
                .map(node => node.data.featureCount)
                .filter(Boolean)
                .forEach(count => {
                    for (const featurekey in count) {
                        if (!hilo[featurekey]) {
                            hilo[featurekey] = count[featurekey];
                        } else {
                            hilo[featurekey].quantity +=
                                count[featurekey].quantity;
                        }
                    }
                });
        }
        n.data.featureCount = hilo;
        return n;
    });
};

interface FeatureCount {
    mad: number;
    max: number;
    median: number;
    min: number;
    total: number;
}

const FeatureSearch: React.FC = () => {
    const [features, setFeatures] = useState<string[]>([]);
    const [featureCounts, setFeatureCounts] = useState<
        Record<string, FeatureCount>
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

            calculateExpressionValues(visibleNodes!, newExpressionThresholds);

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

        const nodes = calculateExpressionValues(
            visibleNodes!,
            expressionThresholds!
        );
        delete featureCounts[featureName];
        delete expressionThresholds![featureName];
        //todo: drop threshold for this item and update display context
        setFeatureCounts(featureCounts);
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

            const median = quantile(range, 0.5)!;

            //for local GUI display
            setFeatureCounts({
                ...featureCounts,
                [feature]: {
                    mad: getMAD(range) || 0,
                    max: max(range) || 0,
                    min: min(range) || 0,
                    median,
                    total: sum(range) || 0,
                },
            });

            const newExpressionThresholds = {
                ...expressionThresholds,
                [feature]: median,
            };

            const withExpression = calculateExpressionValues(
                visibleNodes,
                newExpressionThresholds
            );

            //todo: update thresholds with new median
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
                                {getEntries(featureCounts).map(([k, v]) => (
                                    <FeaturePill
                                        count={v.total.toLocaleString()}
                                        key={k}
                                        name={k}
                                        removeFeature={removeFeature}
                                    />
                                ))}
                            </FeatureList>
                        </FeatureListContainer>
                        <Column>
                            {getEntries(expressionThresholds).map(([k, v]) => (
                                <Column key={k}>
                                    <Row margin="0px">Feature Name: {k}</Row>
                                    <Row margin="0px">
                                        High/Low Threshold:{' '}
                                        {expressionThresholds![k]}
                                    </Row>
                                    <Row margin="0px">
                                        Threshold measure:{' '}
                                        {'Count of cells with feature in node'}
                                    </Row>
                                    <Row margin="0px">
                                        Median Count per node:{' '}
                                        {featureCounts[k].median}
                                    </Row>
                                    <Row margin="0px">
                                        MAD:
                                        {featureCounts[k].mad}
                                    </Row>
                                    <Row margin="0px">
                                        <span>{featureCounts[k].min}</span>
                                        <input
                                            type="range"
                                            max={featureCounts[k].max}
                                            min={featureCounts[k].min}
                                            step={1}
                                            value={v}
                                            onChange={v =>
                                                updateExpressionThresholds(
                                                    k,
                                                    +v.currentTarget.value
                                                )
                                            }
                                        />
                                        <span>{featureCounts[k].max}</span>
                                    </Row>
                                </Column>
                            ))}
                        </Column>
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
