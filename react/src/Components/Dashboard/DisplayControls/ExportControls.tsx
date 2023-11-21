import React, { useMemo, useState } from 'react';
import { saveAs } from 'file-saver';
import { downloadPng, downloadSvg } from '../../../downloadImage';
import {
    useAppSelector,
    useColorScale,
    useDownloadNodeMeta,
    useExportState,
    useSelectTree,
} from '../../../hooks';
import Button from '../../Button';
import { WidgetTitle } from '../../Layout';
import { SelectPanel } from '../..';
import { selectAnnotationSlice } from '../../../redux/annotationSlice';

const ExportControls: React.FC = () => {
    const [panelOpen, setPanelOpen] = useState(false);

    const { scale: colorScale } = useColorScale();

    const { activeFeatures } = useAppSelector(selectAnnotationSlice);

    const state = useExportState();

    const { selector } = useSelectTree();

    const downloadMeta = useDownloadNodeMeta();

    const downloads: Record<string, () => void> = useMemo(() => {
        return {
            exportClusterTree: downloadMeta.bind(null, 'cluster'),
            exportCsv: downloadMeta.bind(null, 'csv'),
            exportJson: downloadMeta.bind(null, 'json'),
            exportPng: downloadPng.bind(
                null,
                colorScale,
                selector,
                activeFeatures
            ),
            exportState: saveAs.bind(
                null,
                `data:text/json,${encodeURIComponent(JSON.stringify(state))}`,
                'tmc-state-export.json'
            ),
            exportSvg: downloadSvg.bind(
                null,
                colorScale,
                selector,
                activeFeatures
            ),
        };
    }, [activeFeatures, colorScale, downloadMeta, selector, state]);

    const items = useMemo(() => {
        return [
            {
                title: 'Export as CSV',
                id: 'exportCsv',
            },
            {
                title: 'Export as JSON',
                id: 'exportJson',
            },
            {
                title: 'Export as Cluster Tree JSON',
                id: 'exportClusterTree',
            },
            {
                title: 'Export as PNG',
                id: 'exportPng',
            },
            {
                title: 'Export as SVG',
                id: 'exportSvg',
            },
            {
                title: 'Export Image Configuration',
                id: 'exportState',
            },
        ];
    }, []);

    return (
        <>
            <WidgetTitle
                caption='Download chart and metadata'
                title='Export Controls'
                helpText='Save the tree locally as an image, JSON, or configuration file.'
            />

            <SelectPanel
                items={items}
                onClose={() => setPanelOpen(false)}
                onSelect={selection => {
                    if (selection) {
                        downloads[selection]();
                        setPanelOpen(false);
                    }
                }}
                open={panelOpen}
            >
                <Button onClick={() => setPanelOpen(true)}>
                    Select Export
                </Button>
            </SelectPanel>
        </>
    );
};

export default ExportControls;
