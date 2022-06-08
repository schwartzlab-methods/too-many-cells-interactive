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
import { quantile } from 'd3-array';
import { HierarchyPointNode } from 'd3-hierarchy';
import styled from 'styled-components';
import { fetchFeatures, fetchFeatureNames } from '../../../../api';
import useClickAway from '../../../hooks/useClickAway';
import {
    buildColorScale,
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
import { AttributeMap, TMCNode } from '../../../types';

/* assumes all cells are up to date with expression values  */
const calculateExpressionValues = (
    nodes: HierarchyPointNode<TMCNode>,
    _thresholds?: Record<string, number>
) => {
    let thresholds: Record<string, number>;
    if (!_thresholds) {
        //if user has not set thresholds, we'll default to median
        const medianMap = nodes
            .leaves()
            .flatMap(l =>
                (l.data.items || []).map(item => item._barcode._featureCounts)
            )
            .filter(item => item !== undefined)
            .reduce<Record<string, number[]>>((acc, curr) => {
                for (const prop in curr) {
                    if (!acc[prop]) {
                        acc[prop] = [curr[prop]!];
                    } else {
                        acc[prop].push(curr[prop]!);
                    }
                }
                return acc;
            }, {});
        thresholds = getEntries(medianMap).reduce<Record<string, number>>(
            (acc, [k, v]) => ({
                ...acc,
                [k]: quantile(v, 0.5) || 0,
            }),
            {}
        );
    } else thresholds = _thresholds;

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
                            v && v > thresholds[k] ? 'high' : 'low'
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
            //average expression per node
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

const FeatureSearch: React.FC = () => {
    const [features, setFeatures] = useState<string[]>([]);
    const [featureCounts, setFeatureCounts] = useState<Record<string, number>>(
        {}
    );
    const [loading, setLoading] = useState(false);
    const {
        displayContext: { visibleNodes },
        setDisplayContext,
    } = useContext(TreeContext);

    const resetOverlay = useCallback(() => {
        setDisplayContext({
            visibleNodes: visibleNodes?.each(n => (n.data.featureCount = {})),
        });
    }, [setDisplayContext]);

    const removeFeature = (featureName: string) => {
        /* 
            first, remove the feature from all **leaves.cells**, then call calculateExpressionValues 
        */

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

        const nodes = calculateExpressionValues(visibleNodes!);
        delete featureCounts[featureName];
        setFeatureCounts(featureCounts);
        updateColorScale(nodes);
    };

    const updateColorScale = (visibleNodes: HierarchyPointNode<TMCNode>) => {
        //if we removed last feature, reset to regular color scale

        const colorScaleKey = Object.values(visibleNodes.data.featureCount)
            .length
            ? 'featureCount'
            : 'labelCount';

        const colorScale = buildColorScale(colorScaleKey, visibleNodes);

        setDisplayContext({ visibleNodes, colorScale, colorScaleKey });
    };

    const getFeature = async (feature: string) => {
        if (visibleNodes) {
            setLoading(true);
            const features = await fetchFeatures(feature);
            const featureMap: Record<string, number> = {};
            let count = 0;

            //create map of features to avoid inner loops
            features.forEach(f => {
                featureMap[f.id] = f.value;
                count += f.value;
            });

            //for GUI display
            setFeatureCounts({ ...featureCounts, [feature]: count });

            // map results to items
            visibleNodes.leaves().forEach(n => {
                if (n.data.items) {
                    n.data.items = n.data.items.map(cell => {
                        //add the new feature to cell-level raw feature counts
                        const fcounts = cell._barcode._featureCounts || {};
                        fcounts[feature] =
                            featureMap[cell._barcode.unCell] || 0;
                        cell._barcode._featureCounts = fcounts;
                        return cell;
                    });
                }
            });

            const withExpression = calculateExpressionValues(visibleNodes);

            updateColorScale(withExpression);

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
                    <FeatureListContainer>
                        <FeatureListLabel>Selected Features</FeatureListLabel>
                        <FeatureList>
                            {getEntries(featureCounts).map(([k, v]) => (
                                <FeaturePill
                                    count={v.toLocaleString()}
                                    key={k}
                                    name={k}
                                    removeFeature={removeFeature}
                                />
                            ))}
                        </FeatureList>
                    </FeatureListContainer>
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
