import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
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
import { scaleIsSequential } from '../../../types';
import { ActionLink, Text } from '../../Typography';
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
                {colorScale && !scaleIsSequential(colorScale) && (
                    <OrdinalLegend
                        scale={colorScale as ScaleOrdinal<string, string>}
                    />
                )}
            </LegendContainer>
            {colorScale && scaleIsSequential(colorScale) && (
                <LinearLegend scale={colorScale} />
            )}
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
        <LegendItemContainer onClick={() => setPickerOpen(true)}>
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
}> = ({ scale }) => {
    const [basePickerOpen, setBasePickerOpen] = useState(false);
    const [indicatorPickerOpen, setIndicatorPickerOpen] = useState(false);
    const [panelOpen, setPanelOpen] = useState(false);
    const {
        scales: { colorScale },
    } = useAppSelector(selectDisplayConfig);

    const dispatch = useAppDispatch();

    const pickerColor = useMemo(() => {
        const idx = basePickerOpen ? 0 : 1;
        return colorScale.variant === 'userAnnotation'
            ? colorScale.userAnnotationRange[idx]
            : colorScale.featureGradientRange[idx];
    }, [basePickerOpen, colorScale]);

    const updateColor = (newColor: string) => {
        const range =
            colorScale.variant === 'userAnnotation'
                ? colorScale.userAnnotationRange.slice()
                : colorScale.featureGradientRange.slice();

        const key =
            colorScale.variant === 'userAnnotation'
                ? 'userAnnotationRange'
                : 'featureGradientRange';

        const newColorIdx = basePickerOpen ? 0 : 1;

        range[newColorIdx] = newColor;

        dispatch(
            updateColorScale({
                [key]: range,
            })
        );
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
    return (
        <>
            {scale
                .domain()
                .sort((a, b) => (a < b ? -1 : 1))
                .map(d => (
                    <LegendItem
                        key={d}
                        label={d}
                        color={scale!(d)}
                        updateColor={(color: string) => {
                            const currColor = scale!(d);
                            const range = scale!
                                .range()
                                .map(r => (currColor === r ? color : r));

                            scale?.range(range);

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
    const selector = 'legend-gradient';

    useLayoutEffect(() => {
        renderLinearLegend(`.${selector}`, scale, height, width);
        //eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scale]);

    return <span className={selector} />;
};

export const renderLinearLegend = (
    selector: string,
    scale: ScaleSequential<string>,
    height: number,
    width: number
) => {
    const gradientId = 'legendGradient';

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
