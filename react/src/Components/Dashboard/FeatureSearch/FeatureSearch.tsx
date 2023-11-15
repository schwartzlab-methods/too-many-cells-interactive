import React, {
    ForwardedRef,
    forwardRef,
    InputHTMLAttributes,
    KeyboardEvent,
    MutableRefObject,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { bindActionCreators } from 'redux';
import styled from 'styled-components';
import { fetchFeatures, fetchFeatureNames } from '../../../../api';
import useClickAway from '../../../hooks/useClickAway';
import {
    addGray,
    getKeys,
    getScaleCombinations,
    interpolateColorScale,
    levenshtein,
} from '../../../util';
import Button from '../../Button';
import { Input, TextArea } from '../../Input';
import { Column, Row, WidgetTitle } from '../../Layout';
import { ActionLink, Caption, Error, Text } from '../../Typography';
import { useAppDispatch, useAppSelector } from '../../../hooks';
import {
    activateFeatureColorScale as _activateFeatureColorScale,
    selectDisplayConfig,
    updateColorScale as _updateColorScale,
    updateColorScaleThresholds as __updateColorScaleThresholds,
    updateColorScaleThresholdUnits as _updateColorScaleThresholdUnits,
    updateColorScaleType as _updateColorScaleType,
} from '../../../redux/displayConfigSlice';
import {
    addFeatures as _addFeatures,
    clearActiveFeatures as _clearActiveFeatures,
    removeActiveFeature as _removeActiveFeature,
    selectAnnotationSlice,
} from '../../../redux/annotationSlice';
import { SmartPruner } from '../DisplayControls/PrunerPanel';
import { CloseIcon } from '../../Icons';
import { RadioButton, RadioGroup, RadioLabel } from '../../Radio';
import QuestionTip from '../../QuestionTip';
import { PlainOrMADVal } from '../../../types';
import LoadingModal from '../../LoadingModal';

const FeatureSearch: React.FC = () => {
    const [bulkFeatureInput, setBulkFeatureInput] = useState('');
    const [featureList, setFeatureList] = useState<string[]>();
    const [loading, setLoading] = useState(false);
    const [lookupType, setLookupType] = useState<'single' | 'bulk'>('single');

    const {
        scales: {
            colorScale: { featureHiLoThresholds, featureHiLoThresholdUnits },
        },
    } = useAppSelector(selectDisplayConfig);

    const { activeFeatures, featureDistributions } = useAppSelector(
        selectAnnotationSlice
    );

    const {
        activateFeatureColorScale,
        addFeatures,
        clearActiveFeatures,
        removeActiveFeature,
        updateColorScale,
        _updateColorScaleThresholds,
        updateColorScaleThresholdUnits,
        updateColorScaleType,
    } = bindActionCreators(
        {
            activateFeatureColorScale: _activateFeatureColorScale,
            addFeatures: _addFeatures,
            clearActiveFeatures: _clearActiveFeatures,
            removeActiveFeature: _removeActiveFeature,
            updateColorScale: _updateColorScale,
            _updateColorScaleThresholds: __updateColorScaleThresholds,
            updateColorScaleThresholdUnits: _updateColorScaleThresholdUnits,
            updateColorScaleType: _updateColorScaleType,
        },
        useAppDispatch()
    );

    useEffect(() => {
        fetchFeatureNames().then(f => {
            setFeatureList(f);
        });
    }, []);

    const bulkFeatureInputError = useMemo(() => {
        if (!bulkFeatureInput) {
            return false;
        } else {
            return !/^[A-Za-z0-9,]+$/.test(bulkFeatureInput);
        }
    }, [bulkFeatureInput]);

    const updateColorScaleThresholds = (key: string, val: PlainOrMADVal) =>
        _updateColorScaleThresholds({ [key]: val });

    const removeFeature = (featureName: string) => {
        removeActiveFeature(featureName);

        const domain = getScaleCombinations(
            activeFeatures.filter(f => f !== featureName)
        );

        const range = addGray(domain, interpolateColorScale(domain));

        updateColorScale({
            featureHiLoRange: range,
            featureHiLoDomain: domain,
        });

        if (activeFeatures.length === 1) {
            updateColorScaleType('labelCount');
        }
    };

    const removeAllFeatures = () => {
        clearActiveFeatures();

        updateColorScale({
            featureHiLoRange: [],
            featureHiLoDomain: [],
            featureScaleSaturation: undefined,
        });

        updateColorScaleType('labelCount');
    };

    const getFeatures = async (features: string) => {
        setLoading(true);
        const featureMap = await fetchFeatures(features);

        const keys = getKeys(featureMap);

        if (keys.length) {
            addFeatures(featureMap);

            const domain = getScaleCombinations(
                activeFeatures
                    .filter(Boolean)
                    .concat(keys)
                    .filter((k, i, a) => a.findIndex(b => b === k) === i)
            );

            const range = addGray(domain, interpolateColorScale(domain));

            updateColorScale({
                featureHiLoRange: range,
                featureHiLoDomain: domain,
            });

            if (!activeFeatures.length) {
                activateFeatureColorScale('sequential');
            }

            setLoading(false);
        } else {
            setLoading(false);
            //todo: null result indicator
        }
    };

    return (
        <Column xs={12}>
            <WidgetTitle
                caption='Search for a feature by identifier'
                helpText='Overlay the tree with feature values from the dataset. Use the inputs below to search.'
                title='Feature Overlays'
            />
            <Row>
                <RadioGroup>
                    <RadioButton
                        checked={lookupType === 'single'}
                        id='single'
                        name='single'
                        onChange={() => setLookupType('single')}
                        type='radio'
                    />
                    <RadioLabel htmlFor='single'>Single Lookup</RadioLabel>
                    <RadioButton
                        checked={lookupType === 'bulk'}
                        id='bulk'
                        name='bulk'
                        onChange={() => setLookupType('bulk')}
                        type='radio'
                    />
                    <RadioLabel htmlFor='bulk'>Bulk Entry</RadioLabel>
                    <QuestionTip message='Enter features as a comma-separated list with no whitespace.' />
                </RadioGroup>
            </Row>
            <Row justifyContent='flex-start'>
                {lookupType === 'single' ? (
                    <Autocomplete
                        options={featureList || []}
                        onSelect={getFeatures}
                    />
                ) : (
                    <Column xs={12}>
                        <Row>
                            <TextArea
                                onChange={e =>
                                    setBulkFeatureInput(e.currentTarget.value)
                                }
                                rows={10}
                            />
                            <Button
                                disabled={
                                    !!bulkFeatureInputError || !bulkFeatureInput
                                }
                                ml='5px'
                                onClick={() => getFeatures(bulkFeatureInput)}
                            >
                                Submit
                            </Button>
                        </Row>
                        {!!bulkFeatureInputError && (
                            <Row>
                                <Text>
                                    <Error>
                                        Feature list must be comma-separated
                                        with no whitespace!
                                    </Error>
                                </Text>
                            </Row>
                        )}
                    </Column>
                )}
            </Row>

            {!!activeFeatures.length && (
                <FeatureListContainer xs={12}>
                    <Row>
                        <Caption>Selected Features</Caption>
                        &nbsp;
                        <Caption>
                            <ActionLink onClick={() => removeAllFeatures()}>
                                Reset
                            </ActionLink>
                        </Caption>
                    </Row>

                    <FeatureList>
                        {Object.keys(featureHiLoThresholds)
                            .filter(k => activeFeatures.includes(k))
                            .map(k => (
                                <SmartPruner
                                    key={k}
                                    expanded={true}
                                    id={k}
                                    label={
                                        <Row justifyContent='space-between'>
                                            {k}&nbsp;
                                            <CloseIcon
                                                onClick={removeFeature.bind(
                                                    null,
                                                    k
                                                )}
                                                pointer
                                                size='10px'
                                                strokeWidth={8}
                                            />
                                        </Row>
                                    }
                                    madSize={featureDistributions[k].mad}
                                    madValues={
                                        featureDistributions[k].madGroups
                                    }
                                    median={featureDistributions[k].median}
                                    plainValues={
                                        featureDistributions[k].plainGroups
                                    }
                                    onViewTypeChange={value =>
                                        updateColorScaleThresholdUnits({
                                            key: k,
                                            value,
                                        })
                                    }
                                    onSubmit={(plainValue, madsValue) =>
                                        updateColorScaleThresholds(k, {
                                            plainValue,
                                            ...{ madsValue },
                                        })
                                    }
                                    xLabel='High-Low threshold'
                                    value={featureHiLoThresholds[k]}
                                    viewType={featureHiLoThresholdUnits[k]}
                                    yLabel='Feature Avg > threshold'
                                />
                            ))}
                    </FeatureList>
                </FeatureListContainer>
            )}
            <LoadingModal open={loading} />
        </Column>
    );
};

const FeatureListContainer = styled(Column)`
    position: relative;
`;

const FeatureList = styled.div`
    display: flex;
    flex-wrap: wrap;
    padding: 8px;
    margin: 5px 0px;
`;

interface AutocompleteProps {
    options: string[];
    onSelect: (feature: string) => void;
}

const Autocomplete: React.FC<AutocompleteProps> = ({ options, onSelect }) => {
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
        //eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedIdx]);

    useEffect(() => {
        if (inputRef.current) {
            parentWidth.current = inputRef.current.clientWidth - 5 + 'px';
        }
        //eslint-disable-next-line react-hooks/exhaustive-deps
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
        <AutocompleteContainer ref={containerRef}>
            <AutocompleteInput
                disabled={!options.length}
                ref={inputRef}
                handleKeyPress={handleKeyPress}
                onChange={e => {
                    setSearch(e.currentTarget.value);
                    setChoicesVisible(true);
                }}
                onClick={() => setChoicesVisible(true)}
                value={options.length ? search : 'Loading...'}
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

const AutocompleteContainer = styled.div`
    display: flex;
    flex-direction: column;
    max-width: 200px;
    position: relative;
`;

const AutocompleteChoicesContainer = styled.div<{ _width: string }>`
    border-radius: 5px;
    display: flex;
    flex-direction: column;
    position: absolute;
    top: 40px;
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
