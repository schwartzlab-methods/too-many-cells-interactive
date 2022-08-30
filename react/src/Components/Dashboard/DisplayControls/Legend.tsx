import React, { useRef, useState } from 'react';
import { ScaleOrdinal, ScaleSequential } from 'd3-scale';
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
import { Text } from '../../Typography';
import { formatDigit } from '../../../util';

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
    width: 200px;
    height: 25px;
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
    const [pickerOpen, setPickerOpen] = useState(false);
    const containerRef = useRef<any>();
    const {
        scales: {
            colorScale: { featureGradientColor },
        },
    } = useAppSelector(selectDisplayConfig);

    const dispatch = useAppDispatch();

    useClickAway(containerRef, () => setPickerOpen(false));

    const updateColor = (newColor: string) => {
        dispatch(updateColorScale({ featureGradientColor: newColor }));
    };

    return (
        <LinearLegendRow>
            <LinearLegendLabel>
                {formatDigit(scale.domain()[0])}
            </LinearLegendLabel>
            <LinearLegendContainer onClick={() => setPickerOpen(true)}>
                <svg viewBox='0 0 200 25'>
                    <linearGradient id='scaleGradient'>
                        <stop
                            offset='5%'
                            //bad source typing
                            stopColor={(scale.range() as any)[0]}
                        />
                        <stop
                            offset='95%'
                            stopColor={
                                //bad source typing
                                (scale.range() as any)[scale.range().length - 1]
                            }
                        />
                    </linearGradient>

                    <rect
                        fill="url('#scaleGradient')"
                        height={25}
                        width={200}
                    />
                </svg>
            </LinearLegendContainer>
            <LinearLegendLabel>
                {formatDigit(scale.domain().slice(-1)[0])}
            </LinearLegendLabel>
            <Popover ref={containerRef} open={pickerOpen}>
                <ColorPicker
                    color={featureGradientColor}
                    updateColor={updateColor}
                />
            </Popover>
        </LinearLegendRow>
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
