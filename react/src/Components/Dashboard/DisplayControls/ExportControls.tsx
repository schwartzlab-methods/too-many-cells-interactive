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
import SelectPanel from '../../SelectPanel';
import { selectFeatureSlice } from '../../../redux/featureSlice';

const ExportControls: React.FC = () => {
    const [panelOpen, setPanelOpen] = useState(false);

    const { scale: colorScale } = useColorScale();

    const { activeFeatures } = useAppSelector(selectFeatureSlice);

    const state = useExportState();

    const { selector } = useSelectTree();

    const downloadMeta = useDownloadNodeMeta();

    const downloads: Record<string, () => void> = useMemo(() => {
        return {
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
    }, [colorScale, downloadMeta, state]);

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
                title='Export Controls'
                caption='Download chart and metadata'
            />
            <Button onClick={() => setPanelOpen(true)}>Select Export</Button>
            {panelOpen && (
                <SelectPanel
                    items={items}
                    onClose={() => setPanelOpen(false)}
                    onSelect={selection => {
                        if (selection) {
                            downloads[selection]();
                            setPanelOpen(false);
                        }
                    }}
                />
            )}
        </>
    );
};

export default ExportControls;