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
import Modal from '../../Modal';
import { ActionLink, Caption } from '../../Typography';
import { useAppDispatch, useAppSelector } from '../../../hooks';
import {
    selectDisplayConfig,
    updateColorScale as _updateColorScale,
    updateColorScaleThresholds as _updateColorScaleThresholds,
    updateColorScaleType as _updateColorScaleType,
} from '../../../redux/displayConfigSlice';
import {
    addFeatures as _addFeatures,
    clearActiveFeatures as _clearActiveFeatures,
    removeActiveFeature as _removeActiveFeature,
    selectFeatureSlice,
} from '../../../redux/featureSlice';
import { SmartPruner } from '../DisplayControls/PrunerPanel';
import { CloseIcon } from '../../Icons';
import { RadioButton, RadioGroup, RadioLabel } from '../../Radio';

const FeatureSearch: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [featureList, setFeatureList] = useState<string[]>();
    const [bulkFeatureInput, setBulkFeatureInput] = useState('');
    const [lookupType, setLookupType] = useState<'single' | 'bulk'>('single');

    const {
        scales: {
            colorScale: { featureHiLoThresholds },
        },
    } = useAppSelector(selectDisplayConfig);

    const { activeFeatures, featureDistributions } =
        useAppSelector(selectFeatureSlice);

    const {
        addFeatures,
        clearActiveFeatures,
        removeActiveFeature,
        updateColorScale,
        updateColorScaleThresholds,
        updateColorScaleType,
    } = bindActionCreators(
        {
            addFeatures: _addFeatures,
            clearActiveFeatures: _clearActiveFeatures,
            removeActiveFeature: _removeActiveFeature,
            updateColorScale: _updateColorScale,
            updateColorScaleThresholds: _updateColorScaleThresholds,
            updateColorScaleType: _updateColorScaleType,
        },
        useAppDispatch()
    );

    useEffect(() => {
        fetchFeatureNames().then(f => {
            setFeatureList(f);
        });
    }, []);

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
                updateColorScaleType('featureHiLos');
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
                title='Feature Overlays'
                caption='Search for a feature by identifier'
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
                    <RadioLabel htmlFor='bulk'>Bulk Lookup</RadioLabel>
                </RadioGroup>
            </Row>
            <Row justifyContent='flex-start'>
                {lookupType === 'single' ? (
                    <Autocomplete
                        options={featureList || []}
                        onSelect={getFeatures}
                    />
                ) : (
                    <>
                        <TextArea
                            onChange={e =>
                                setBulkFeatureInput(e.currentTarget.value)
                            }
                            rows={10}
                        />
                        <Button
                            disabled={!bulkFeatureInput}
                            ml='5px'
                            onClick={() => getFeatures(bulkFeatureInput)}
                        >
                            Submit
                        </Button>
                    </>
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
                                    onSubmit={v =>
                                        updateColorScaleThresholds({
                                            [k]: v,
                                        })
                                    }
                                    xLabel='Theshold'
                                    value={featureHiLoThresholds[k]}
                                />
                            ))}
                    </FeatureList>
                </FeatureListContainer>
            )}
            <Modal open={loading} message='Loading...' />
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
