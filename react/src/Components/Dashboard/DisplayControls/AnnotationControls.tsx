import React, { useRef, useState } from 'react';
import { bindActionCreators } from 'redux';
import styled from 'styled-components';
import { Column, WidgetTitle } from '../../Layout';
import { addUserAnnotation as _addUserAnnotation } from '../../../redux/annotationSlice';
import { updateColorScale as _updateColorScale } from '../../../redux/displayConfigSlice';
import { Button, Caption, Error } from '../..';
import { AttributeMap } from '../../../types';
import { useAppDispatch } from '../../../hooks';
import { textToAnnotations } from '../../../util';

const AnnotationControls: React.FC = () => {
    const [uploadError, setUploadError] = useState('');
    const [inputKey, setInputKey] = useState(Math.random());

    const { addUserAnnotation, updateColorScale } = bindActionCreators(
        {
            addUserAnnotation: _addUserAnnotation,
            updateColorScale: _updateColorScale,
        },
        useAppDispatch()
    );

    const inputRef = useRef<HTMLInputElement>(null);

    const resetUpload = () => {
        setUploadError('');
        setInputKey(Math.random());
    };

    const processUpload = async (data: FileList | null) => {
        if (data && data.length) {
            resetUpload();
            const text = await data[0].text();

            let annotations: AttributeMap;

            try {
                annotations = textToAnnotations(text);
            } catch (e) {
                setUploadError(e as string);
                return;
            }

            addUserAnnotation(annotations);
            updateColorScale({ variant: 'userAnnotation' });
        }
    };

    return (
        <Column xs={12}>
            <WidgetTitle
                helpText='Use to set numeric values of each node for custom coloring.
                This coloring overrides the normal average color blending procedure with exact values.
                The annotations file should be 2-column csv with a column of node ids called node_id and a second column of corresponding numeric annotations for each node.'
                caption='Upload custom node-level annotations'
                title='Annotation Upload'
            />
            <Button onClick={() => inputRef.current!.click()}>
                Select Annotations
            </Button>
            <input
                accept='.csv'
                hidden
                key={inputKey}
                onChange={f => processUpload(f.currentTarget.files)}
                ref={inputRef}
                type='file'
            />
            {uploadError && (
                <ErrorContainer>
                    <Caption>
                        <Error>{uploadError}</Error>
                    </Caption>
                </ErrorContainer>
            )}
        </Column>
    );
};

const ErrorContainer = styled.div`
    margin: 5px;
`;

export default AnnotationControls;
