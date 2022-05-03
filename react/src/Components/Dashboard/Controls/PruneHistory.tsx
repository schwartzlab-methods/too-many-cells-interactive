import React, { useContext } from 'react';
import styled from 'styled-components';
import { pruneContextIsEmpty } from '../../../util';
import Button from '../../Button';
import { Column, Row } from '../../Layout';
import { Text, Title } from '../../Typography';
import { makeFreshPruneContext, PruneContext, TreeContext } from '../Dashboard';

const PruneHistory: React.FC = () => {
    const treeContext = useContext(TreeContext);
    const { setTreeContext } = treeContext;

    return (
        <Column>
            <Row justifyContent="space-between" margin="0px">
                <Title>Pruning History</Title>
                <ButtonContainer>
                    <Button
                        disabled={
                            treeContext.pruneContext.length === 1 &&
                            pruneContextIsEmpty(
                                treeContext.pruneContext.slice(-1)[0]
                            )
                        }
                        onClick={() =>
                            setTreeContext({
                                pruneContext: [makeFreshPruneContext()],
                            })
                        }
                    >
                        Reset
                    </Button>
                    <Button
                        disabled={pruneContextIsEmpty(
                            treeContext.pruneContext.slice(-1)[0]
                        )}
                        onClick={() => {
                            const pruneContext =
                                treeContext.pruneContext.slice();
                            pruneContext.push(makeFreshPruneContext());
                            setTreeContext({ pruneContext });
                        }}
                    >
                        Apply
                    </Button>
                </ButtonContainer>
            </Row>
            <Row margin="0px">
                {treeContext.pruneContext.map((ctx, i) => (
                    <PruneStep
                        key={i}
                        active={i === treeContext.pruneContext.length - 1}
                        empty={pruneContextIsEmpty(ctx)}
                        index={i}
                        pruneContext={ctx}
                        setActive={() => {
                            setTreeContext({
                                pruneContext: treeContext.pruneContext.slice(
                                    0,
                                    i + 1
                                ),
                            });
                        }}
                    />
                ))}
            </Row>
        </Column>
    );
};

interface PruneStepProps {
    active: boolean;
    empty: boolean;
    index: number;
    pruneContext: PruneContext;
    setActive: () => void;
}

const PruneStep: React.FC<PruneStepProps> = ({
    active,
    empty,
    index,
    pruneContext,
    setActive,
}) => {
    return (
        <PruneStepContainer
            onClick={() => !empty && setActive()}
            active={active}
            empty={empty}
        >
            <Text>Prune {index + 1}</Text>
        </PruneStepContainer>
    );
};

const PruneStepContainer = styled.div<{ active: boolean; empty: boolean }>`
    background-color: ${props => props.theme.palette.primary};
    border: ${props =>
        props.active ? `solid 2px ${props.theme.palette.grey}` : 'auto'};
    color: ${props => (props.active ? 'white' : 'inherit')};
    cursor: ${props => (props.empty ? 'auto' : 'pointer')};
    display: flex;
    align-items: center;
    padding: 5px;
    margin: 5px;
    border-radius: 3px;
`;

const ButtonContainer = styled.div`
    Button + Button {
        margin-left: 10px;
    }
`;

export default PruneHistory;
