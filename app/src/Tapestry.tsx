
import { Layer, Rect, Stage, Image, Group } from 'react-konva';
import React, { FC, useEffect, useState, useCallback, useMemo } from 'react';
import { TapestryPatchAccount, TapestryChunk, TapestryClient, MAX_CHUNK_IDX, MIN_CHUNK_IDX } from '@tapestrydao/client';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { string } from 'yargs';
import { getThemeProps } from '@mui/system';

const WIDTH = 48 * 8
const HEIGHT = 48 * 8

const grid = [["red", "yellow"], ["green", "blue"]];

type KonvaPatchProps = {
    patch: TapestryPatchAccount | null,
    patch_x: number,
    patch_y: number,
    layer_x: number,
    layer_y: number,
}

let imageCache = new Map<string, ImageBitmap>();

export const KonvaPatch: FC<KonvaPatchProps> = ({
    patch,
    patch_x,
    patch_y,
    layer_x,
    layer_y,
}: KonvaPatchProps) => {

    const [imageBitmap, setImageBitmap] = useState<ImageBitmap | undefined>(
        imageCache.get("image:" + patch_x + ":" + patch_y));

    // useMemo()

    useEffect(() => {
        if (imageBitmap != undefined) return;

        let cachedBitmap = imageCache.get("image:" + patch_x + ":" + patch_y)

        if (cachedBitmap != undefined) {
            console.log("Set bitmap from cache")
            setImageBitmap(cachedBitmap)
        }

        // console.log("Rendering Image for " + patch_x + " , " + patch_y)
        // console.log("Render Image")
        let imageData = patch?.data.image_data
        if (!!imageData) {
            console.log("Render Image")
            let buffer = new Uint8Array(imageData);
            let blob = new Blob([buffer], { type: "image/gif" })
            createImageBitmap(blob).then((value) => {
                imageCache.set("image:" + patch_x + ":" + patch_y, value)
                setImageBitmap(value)
            })
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
            strokeWidth={1}>
        </Image>
    )
}

type KonvaChunkProps = {
    xChunk: number,
    yChunk: number,
    xCanvas: number,
    yCanvas: number,
}

// sort of unsure if this is helping
let chunkCache = new Map<string, JSX.Element>()

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

    let patches = []
    for (var row = 0; row < 8; row++) {
        for (var col = 0; col < 8; col++) {
            const patch = chunk.chunkAccounts[row][col]
            const patchCoords = chunk.getPatchCoordsForChunkIndex(row, col);
            const key = "kpatch:" + patchCoords.x + patchCoords.y
            patches.push(<KonvaPatch
                key={key}
                patch_x={patchCoords.x}
                patch_y={patchCoords.y}
                layer_x={row * (WIDTH / 8)}
                layer_y={col * (HEIGHT / 8)}
                patch={patch}
            />)
        }
    }

    // console.log("Render: xChunk=" + xChunk + " yChunk=" + yChunk)
    console.log("Render Chunk")

    return (
        <Group
            key={"chunk_group:" + xChunk + "," + yChunk}
            x={xCanvas}
            y={yCanvas}>
            {patches}
        </Group>
    )
}

export const KonvaTapestry: FC = () => {
    const [stagePos, setStagePos] = React.useState({ x: 0, y: 0 });
    const { connection } = useConnection()

    useEffect(() => {
        console.log("updating connection for Tapestry Client")
        TapestryClient.getInstance().setConnection(connection)
    }, [connection])

    const startX = Math.floor((-stagePos.x - window.innerWidth) / WIDTH) * WIDTH;
    const endX =
        Math.floor((-stagePos.x + window.innerWidth * 2) / WIDTH) * WIDTH;

    const startY =
        Math.floor((-stagePos.y - window.innerHeight) / HEIGHT) * HEIGHT;
    const endY =
        Math.floor((-stagePos.y + window.innerHeight * 2) / HEIGHT) * HEIGHT;


    const tlChunkPosX = startX / WIDTH
    const tlChunkPosY = startY / HEIGHT

    console.log("Render: tlChunk = " + tlChunkPosX + ", " + tlChunkPosY)

    const gridComponents = [];
    var i = 0;
    for (var x = startX; x < endX; x += WIDTH) {
        for (var y = startY; y < endY; y += HEIGHT) {
            if (i === 4) {
                i = 0;
            }

            const indexX = x / WIDTH;
            const indexY = y / HEIGHT;

            // console.log("indexX=" + indexX + " indexY=" + indexY);
            const colorX = Math.abs(indexX) % grid.length;
            const colorY = Math.abs(indexY) % grid[0].length;
            const fill = grid[colorX][colorY];

            const key = "kchunk:" + indexX + ":" + indexY
            let existingChunk = chunkCache.get(key)
            if (indexX > MAX_CHUNK_IDX
                || indexX < MIN_CHUNK_IDX
                || indexY > MAX_CHUNK_IDX
                || indexY < MIN_CHUNK_IDX) {
                console.log("You've reached the edge!")
                continue
            }

            if (existingChunk != undefined) {
                gridComponents.push(existingChunk)
            } else {
                const newChunk = <KonvaChunk
                    key={key}
                    xChunk={indexX}
                    yChunk={indexY}
                    xCanvas={x}
                    yCanvas={y}
                />
                chunkCache.set(key, newChunk);
                gridComponents.push(newChunk)
            }
        }
    }
    return (
        <Stage
            x={stagePos.x}
            y={stagePos.y}
            width={window.innerWidth}
            height={window.innerHeight}
            draggable
            onDragEnd={e => {
                setStagePos(e.currentTarget.position());
            }}
        >
            <Layer>{gridComponents}</Layer>
        </Stage>
    );
};