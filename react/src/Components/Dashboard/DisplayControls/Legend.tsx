import React, {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { range } from 'd3-array';
import { color as d3Color } from 'd3-color';
import { ScaleOrdinal, ScaleSequential } from 'd3-scale';
import { select } from 'd3-selection';
import styled from 'styled-components';
import { HexColorPicker } from 'react-colorful';
import { DotIcon } from '../../Icons';
import { Column, List, WidgetTitle } from '../../Layout';
import { Input } from '../../Input';
import { useAppDispatch, useAppSelector, useColorScale } from '../../../hooks';
import {
    selectDisplayConfig,
    updateActiveOrdinalColorScale,
    updateColorScale,
} from '../../../redux/displayConfigSlice';
import { scaleIsFeatureIndividual, scaleIsSequential } from '../../../types';
import { ActionLink, Caption, Text } from '../../Typography';
import { formatDigit } from '../../../util';
import { Popover } from '../../../Components';

const LegendContainer = styled.div<{ maxHeight?: number }>`
    max-height: ${props => (props.maxHeight ? `${props.maxHeight}px` : 'auto')};
    overflow-y: auto;
    padding: 3px;
    width: 100%;
`;

const Legend: React.FC<{ maxHeight?: number }> = ({ maxHeight }) => {
    const { scale: colorScale } = useColorScale();

    return (
        <Column xs={12} className='legend'>
            <WidgetTitle title='Legend' />
            <LegendContainer maxHeight={maxHeight}>
                {colorScale &&
                    !scaleIsFeatureIndividual(colorScale) &&
                    !scaleIsSequential(colorScale) && (
                        <OrdinalLegend
                            scale={colorScale as ScaleOrdinal<string, string>}
                        />
                    )}
                {colorScale &&
                    !scaleIsFeatureIndividual(colorScale) &&
                    scaleIsSequential(colorScale) && (
                        <LinearLegend scale={colorScale} />
                    )}
                {colorScale &&
                    scaleIsFeatureIndividual(colorScale) &&
                    Object.entries(colorScale).map(([k, v]) => (
                        <span key={k}>
                            <Caption>{k}</Caption>
                            <LinearLegend scale={v} scaleName={k} />
                        </span>
                    ))}
            </LegendContainer>
        </Column>
    );
};

interface LegendItemProps {
    color: string;
    label: string;
    updateColor: (color: string) => void;
}

const LegendItem: React.FC<LegendItemProps> = ({
    color,
    label,
    updateColor,
}) => {
    const [pickerOpen, setPickerOpen] = useState(false);
    return (
        <LegendItemContainer>
            <Popover
                open={pickerOpen}
                onOpenChange={() => setPickerOpen(!pickerOpen)}
                Anchor={
                    <DotIcon
                        pointer
                        fill={color}
                        stroke={color}
                        onClick={() => setPickerOpen(true)}
                    />
                }
                Content={
                    <ColorPicker color={color} updateColor={updateColor} />
                }
            />
            {label}
        </LegendItemContainer>
    );
};

const PickerInput = styled(Input)`
    width: 95%;
`;

interface ColorPickerProps {
    color: string;
    updateColor: (color: string) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ color, updateColor }) => {
    // use a wrapper to prevent submission of invalid values
    const [internalVal, setInternalVal] = useState(color);

    useEffect(() => {
        setInternalVal(color);
    }, [color]);

    const _updateColor = (color: string) =>
        d3Color(color) ? updateColor(color) : setInternalVal(color);

    return (
        <Column xs={12}>
            <HexColorPicker color={color} onChange={updateColor} />
            <PickerInput
                value={internalVal}
                onChange={e => _updateColor(e.currentTarget.value)}
            />
        </Column>
    );
};

const LegendItemContainer = styled.span`
    align-items: center;
    display: flex;
    position: relative;
`;

const LinearLegendContainer = styled.div`
    cursor: pointer;
    height: 25px;
    width: 200px;
`;

const LinearLegendLabel = styled(Text)`
    margin: 0px 3px;
`;

const LinearLegendRow = styled.div`
    align-items: center;
    display: flex;
    position: relative;
`;

const LinearLegendList = styled(List)`
    width: max-content;
    li + li {
        margin-top: 5px;
    }
`;

const LinearLegend: React.FC<{
    scale: ScaleSequential<string>;
    scaleName?: string;
}> = ({ scale, scaleName }) => {
    const [basePickerOpen, setBasePickerOpen] = useState(false);
    const [indicatorPickerOpen, setIndicatorPickerOpen] = useState(false);
    const [panelOpen, setPanelOpen] = useState(false);
    const {
        scales: { colorScale },
    } = useAppSelector(selectDisplayConfig);

    const dispatch = useAppDispatch();

    const updateRange = (
        key: string,
        range: [string, string],
        scaleName?: string
    ) =>
        dispatch(
            updateColorScale(
                scaleName
                    ? {
                          [key]: {
                              ...colorScale.featuresGradientRanges,
                              [scaleName]: range,
                          },
                      }
                    : {
                          [key]: range,
                      }
            )
        );

    const [range, rangeKey] = useMemo(() => {
        switch (colorScale.variant) {
            case 'userAnnotation':
                return [colorScale.userAnnotationRange, 'userAnnotationRange'];
            case 'featureAverage':
                return [
                    colorScale.featureGradientRange,
                    'featureGradientRange',
                ];
            default:
                return [
                    colorScale.featuresGradientRanges[scaleName!],
                    'featuresGradientRanges',
                ];
        }
    }, [colorScale, scaleName]);

    const pickerColor = useMemo(() => {
        const idx = basePickerOpen ? 0 : 1;
        //we have to get the scale from the store or we'll get circular updates
        return range[idx];
    }, [basePickerOpen, range]);

    const updateColor = (newColor: string) => {
        const _range = range.slice() as [string, string];

        const newColorIdx = basePickerOpen ? 0 : 1;

        _range[newColorIdx] = newColor;

        updateRange(rangeKey, _range, scaleName);
    };

    return (
        <div>
            <LinearLegendRow>
                <Popover
                    open={basePickerOpen}
                    onOpenChange={() => setBasePickerOpen(false)}
                    Anchor={
                        <LinearLegendLabel>
                            {formatDigit(scale.domain()[0])}
                        </LinearLegendLabel>
                    }
                    Content={
                        <ColorPicker
                            color={pickerColor}
                            updateColor={updateColor}
                        />
                    }
                />
                <LinearLegendContainer onClick={() => setPanelOpen(true)}>
                    <Popover
                        open={panelOpen}
                        onOpenChange={() => setPanelOpen(!panelOpen)}
                        Content={
                            <LinearLegendList>
                                <li>
                                    <Text>
                                        <ActionLink
                                            onClick={() => {
                                                setBasePickerOpen(true);
                                                setIndicatorPickerOpen(false);
                                            }}
                                        >
                                            Set base color
                                        </ActionLink>
                                    </Text>
                                </li>
                                <li>
                                    <Text>
                                        <ActionLink
                                            onClick={() => {
                                                setIndicatorPickerOpen(true);
                                                setBasePickerOpen(false);
                                            }}
                                        >
                                            Set indicator color
                                        </ActionLink>
                                    </Text>
                                </li>
                            </LinearLegendList>
                        }
                        Anchor={
                            <LegendGradient
                                scale={scale}
                                height={25}
                                width={200}
                            />
                        }
                    />
                </LinearLegendContainer>
                <Popover
                    open={indicatorPickerOpen}
                    onOpenChange={() => setIndicatorPickerOpen(false)}
                    Anchor={
                        <LinearLegendLabel>
                            {formatDigit(scale.domain().slice(-1)[0])}
                        </LinearLegendLabel>
                    }
                    Content={
                        <ColorPicker
                            color={pickerColor}
                            updateColor={updateColor}
                        />
                    }
                />
            </LinearLegendRow>
        </div>
    );
};

const OrdinalLegend: React.FC<{ scale: ScaleOrdinal<string, string> }> = ({
    scale,
}) => {
    const dispatch = useAppDispatch();

    const rangeDomain = scale
        .domain()
        .map(domain => ({
            domain,
            range: scale(domain),
        }))
        .sort((a, b) => (a.domain < b.domain ? -1 : 1));

    return (
        <>
            {rangeDomain.map(({ domain }, i) => (
                <LegendItem
                    key={domain}
                    label={domain}
                    color={scale!(domain)}
                    updateColor={(color: string) => {
                        const range = rangeDomain.map((r, rdi) =>
                            rdi === i ? color : r.range
                        );

                        dispatch(
                            updateActiveOrdinalColorScale({
                                range,
                                domain: scale.domain(),
                            })
                        );
                    }}
                />
            ))}
        </>
    );
};
export default Legend;

interface LegendGradientProps {
    scale: ScaleSequential<string>;
    height: number;
    width: number;
}

const LegendGradient: React.FC<LegendGradientProps> = ({
    height,
    scale,
    width,
}) => {
    const selector = useRef(
        `legend-gradient-${Math.random().toString(36).slice(3)}`
    );

    useLayoutEffect(() => {
        renderLinearLegend(`.${selector.current}`, scale, height, width);
        //eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scale]);

    return <span className={selector.current} />;
};

export const renderLinearLegend = (
    selector: string,
    scale: ScaleSequential<string>,
    height: number,
    width: number
) => {
    const gradientId = `legendGradient-${Math.random().toString(36).slice(3)}`;

    const svg = select(selector)
        .selectAll('svg')
        .data([1], Math.random)
        .join('svg')
        .attr('viewBox', `0 0 ${width} ${height}`);

    svg.append('defs')
        .append('linearGradient')
        .attr('id', gradientId)
        .selectAll('stop')
        .data(range(0, 1, 0.01), Math.random)
        .join('stop')
        .attr('offset', d => `${d * 100}%`)
        .attr('stop-color', d => scale.interpolator()(d));

    svg.selectAll('rect')
        .data([1], Math.random)
        .join('rect')
        .attr('height', height)
        .attr('width', width)
        .attr('fill', `url(#${gradientId})`);
};
