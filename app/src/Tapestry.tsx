
import { Layer, Rect, Stage, Image, Group, Text, Circle } from 'react-konva';
import React, { FC, useEffect, useState, useCallback, useMemo } from 'react';
import { TapestryPatchAccount, TapestryChunk, TapestryClient, MAX_CHUNK_IDX, MIN_CHUNK_IDX } from '@tapestrydao/client';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { string } from 'yargs';
import { getThemeProps } from '@mui/system';
import { Vector2d } from 'konva/lib/types';

const WIDTH = 48 * 8
const HEIGHT = 48 * 8

type KonvaPatchProps = {
    patch: TapestryPatchAccount | null,
    patch_x: number,
    patch_y: number,
    layer_x: number,
    layer_y: number,
}

export const KonvaPatch: FC<KonvaPatchProps> = ({
    patch,
    patch_x,
    patch_y,
    layer_x,
    layer_y,
}: KonvaPatchProps) => {

    const [imageBitmap, setImageBitmap] = useState<ImageBitmap | undefined>(undefined);

    useEffect(() => {
        let imageData = patch?.data.image_data
        if (!!imageData) {
            console.log("Render Image")
            let buffer = new Uint8Array(imageData);
            let blob = new Blob([buffer], { type: "image/gif" })
            try {
                createImageBitmap(blob).then((value) => {
                    setImageBitmap(value)
                })
            } catch (e) {
                console.log("Error decoding image? " + e)
            }
        }
    }, [patch])

    return (
        <Image
            key={patch_x + "," + patch_y}
            x={layer_x}
            y={layer_y}
            width={WIDTH / 8}
            height={HEIGHT / 8}
            stroke={"black"}
            image={imageBitmap}
            strokeWidth={1}
            onClick={() => { console.log("clicked: ", patch_x, ",", patch_y) }}>
        </Image>
    )
}

type KonvaChunkProps = {
    xChunk: number,
    yChunk: number,
    xCanvas: number,
    yCanvas: number,
}

export const KonvaChunk: FC<KonvaChunkProps> = ({ xChunk, yChunk, xCanvas, yCanvas }: KonvaChunkProps) => {
    const { publicKey } = useWallet();

    const [chunk, setChunk] = useState<TapestryChunk>(TapestryChunk.getEmptyChunk(xChunk, yChunk));

    useEffect(() => {
        TapestryClient.getInstance().fetchChunk(xChunk, yChunk).then((chunk) => {
            setChunk(chunk);
        })
    }, [xChunk, yChunk])

    // useEffect(() => {
    //     // check if chunk is owned by user
    // }, [publicKey, chunk])

    const searchParams = new URLSearchParams(location.search)
    let debugMode = !!searchParams.get("debug")

    let patches = []
    for (var row = 0; row < 8; row++) {
        for (var col = 0; col < 8; col++) {
            const patch = chunk.chunkAccounts[row][col]
            const patchCoords = chunk.getPatchCoordsForChunkIndex(row, col);
            const key = "kpatch:" + patchCoords.x + "," + patchCoords.y
            patches.push(<KonvaPatch
                key={key}
                patch_x={patchCoords.x}
                patch_y={patchCoords.y}
                layer_x={row * (WIDTH / 8)}
                layer_y={col * (HEIGHT / 8)}
                patch={patch}
            />)

            if (debugMode) {
                patches.push(
                    <Text
                        key={"label" + key}
                        x={row * (WIDTH / 8)}
                        y={col * (HEIGHT / 8)}
                        width={WIDTH / 8}
                        height={HEIGHT / 8}
                        verticalAlign='middle'
                        align='center'
                        text={"x:" + patchCoords.x + "\ny:" + patchCoords.y}
                    />
                )
            }
        }
    }

    return (
        <Group
            key={"chunk_group:" + xChunk + "," + yChunk}
            x={xCanvas}
            y={yCanvas}
            strokeWidth={1}
            stroke="black">
            <Rect
                x={0}
                y={0}
                width={WIDTH}
                height={HEIGHT}
                strokeWidth={1}
                stroke="red"
            />
            {patches}
        </Group>
    )
}

export const KonvaTapestry: FC = () => {

    const startingLocation = () => {
        const searchParams = new URLSearchParams(location.search)
        const xStr = searchParams.get("x")
        const yStr = searchParams.get("y")

        if (xStr == null || yStr == null) return { x: 0, y: 0 }

        return { x: -parseInt(xStr) * (WIDTH / 8), y: parseInt(yStr) * (HEIGHT / 8) }
    }

    const [stagePos, setStagePos] = React.useState(startingLocation());
    const { connection } = useConnection()

    useEffect(() => {
        console.log("updating connection for Tapestry Client")
        TapestryClient.getInstance().setConnection(connection)
    }, [connection])

    let tapStagePosX = stagePos.x
    let tapStagePosY = stagePos.y

    // Find x and y coordinates that align with chunk boundaries
    const startX = Math.floor((-tapStagePosX - (window.innerWidth * 1.5)) / WIDTH) * WIDTH
    const endX = Math.floor((-tapStagePosX + (window.innerWidth * 1.5)) / WIDTH) * WIDTH
    const startY = Math.floor((-tapStagePosY - (window.innerHeight * 1.5)) / HEIGHT) * HEIGHT
    const endY = Math.floor((-tapStagePosY + (window.innerHeight * 1.5)) / HEIGHT) * HEIGHT

    console.log("Stage Pos: ", stagePos.x, " , ", stagePos.y)

    const gridComponents = []
    for (var x = startX; x < endX; x += WIDTH) {
        for (var y = startY; y < endY; y += HEIGHT) {

            const indexX = x / WIDTH;
            const indexY = (-y / HEIGHT) - 1;

            const key = "kchunk:" + indexX + ":" + indexY
            if (indexX > MAX_CHUNK_IDX
                || indexX < MIN_CHUNK_IDX
                || indexY > MAX_CHUNK_IDX
                || indexY < MIN_CHUNK_IDX) {
                console.log("You've reached the edge!")
                continue
            }

            const stageX = x
            const stageY = y

            const newChunk = <KonvaChunk
                key={key}
                xChunk={indexX}
                yChunk={indexY}
                xCanvas={stageX}
                yCanvas={stageY}
            />

            gridComponents.push(newChunk)
        }
    }

    return (
        <Stage
            x={stagePos.x}
            y={stagePos.y}
            offsetX={-window.innerWidth / 2.0}
            offsetY={-window.innerHeight / 2.0}
            width={window.innerWidth}
            height={window.innerHeight}
            draggable
            onDragEnd={e => {
                setStagePos(e.currentTarget.position());
            }}>
            <Layer>
                {gridComponents}
                <Circle x={0} y={0} width={20} height={20} fill='red' />
            </Layer>
        </Stage>
    );
};