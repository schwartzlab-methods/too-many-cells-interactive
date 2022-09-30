import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ScaleOrdinal, ScaleSequential } from 'd3-scale';
import { select } from 'd3-selection';
import { range } from 'd3-array';
import styled from 'styled-components';
import { HexColorPicker } from 'react-colorful';
import useClickAway from '../../../hooks/useClickAway';
import { DotIcon } from '../../Icons';
import { Column, WidgetTitle } from '../../Layout';
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
import { FlexPanel } from '../../SelectPanel';

const Legend: React.FC = () => {
    const { scale: colorScale } = useColorScale();

    return (
        <Column xs={12} className='legend'>
            <WidgetTitle title='Legend' />
            {colorScale && !scaleIsSequential(colorScale) && (
                <OrdinalLegend
                    scale={colorScale as ScaleOrdinal<string, string>}
                />
            )}
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
    const containerRef = useRef<any>();

    useClickAway(containerRef, () => setPickerOpen(false));

    return (
        <LegendItemContainer onClick={() => setPickerOpen(true)}>
            <DotIcon
                pointer
                fill={color}
                stroke={color}
                onClick={() => setPickerOpen(true)}
            />
            {label}
            <Popover ref={containerRef} open={pickerOpen}>
                <ColorPicker color={color} updateColor={updateColor} />
            </Popover>
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
    return (
        <Column xs={12}>
            <HexColorPicker color={color} onChange={updateColor} />
            <PickerInput
                value={color}
                onChange={e => updateColor(e.currentTarget.value)}
            />
        </Column>
    );
};

const LegendItemContainer = styled.span`
    align-items: center;
    display: flex;
    position: relative;
`;

const Popover = styled.div<{ open: boolean }>`
    background-color: ${props => props.theme.palette.white};
    display: ${props => (props.open ? 'flex' : 'none')};
    position: absolute;
    bottom: 15px;
    left: 0;
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

const LinearLegend: React.FC<{
    scale: ScaleSequential<string>;
}> = ({ scale }) => {
    const [basePickerOpen, setBasePickerOpen] = useState(false);
    const [targetPickerOpen, setIndicatorPickerOpen] = useState(false);
    const [panelOpen, setPanelOpen] = useState(false);
    const containerRef = useRef<any>();
    const {
        scales: { colorScale },
    } = useAppSelector(selectDisplayConfig);

    const dispatch = useAppDispatch();

    const closePanels = () => {
        setBasePickerOpen(false);
        setIndicatorPickerOpen(false);
        setPanelOpen(false);
    };

    const pickerColor = useMemo(() => {
        const idx = basePickerOpen ? 0 : 1;
        return colorScale.variant === 'userAnnotation'
            ? colorScale.userAnnotationRange[idx]
            : colorScale.featureGradientRange[idx];
    }, [basePickerOpen, colorScale]);

    useClickAway(containerRef, closePanels);

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
        <div ref={containerRef}>
            {panelOpen && (
                <>
                    <FlexPanel onClose={() => setPanelOpen(false)}>
                        <Text onClick={() => setBasePickerOpen(true)}>
                            <ActionLink>Set base color</ActionLink>
                        </Text>
                        <Text onClick={() => setIndicatorPickerOpen(true)}>
                            <ActionLink>Set indicator color</ActionLink>
                        </Text>
                    </FlexPanel>
                </>
            )}
            <LinearLegendRow>
                <LinearLegendLabel>
                    {formatDigit(scale.domain()[0])}
                </LinearLegendLabel>
                <LinearLegendContainer onClick={() => setPanelOpen(true)}>
                    <LegendGradient scale={scale} height={25} width={200} />
                </LinearLegendContainer>
                <LinearLegendLabel>
                    {formatDigit(scale.domain().slice(-1)[0])}
                </LinearLegendLabel>
                <Popover open={basePickerOpen || targetPickerOpen}>
                    <ColorPicker
                        color={pickerColor}
                        updateColor={updateColor}
                    />
                </Popover>
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
