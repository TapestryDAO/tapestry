import React, { FC, useEffect, useRef, useState } from 'react';
import { PlaceClient, PlaceProgram } from '@tapestrydao/place-client'
import { renderToStaticMarkup } from "react-dom/server"
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js'
import BN from 'bn.js';

const DRAW_RATE_MS = 1000 / 10;
const MAX_SCALE = 40;
const MIN_SCALE = 0.5;
const PLACE_WIDTH = 1000;
const PLACE_HEIGHT = 1000;

export const TapestryCanvas: FC = (props) => {
    let thing = PlaceClient.getInstance();
    thing.subscribeToPatchUpdates();

    const { publicKey, sendTransaction } = useWallet();
    const { connection } = useConnection();

    const canvasRef = useRef(null);
    const animateRequestRef = useRef<number>(null);
    const previousTimeRef = useRef<number>(null);
    const prevMousePos = useRef<number[]>([0, 0])
    const dragImageRef = useRef(null);

    const [scale, setScale] = useState<number>(1);
    const [canvasTranslation, setCanvasTranslation] = useState<number[]>([0, 0]);
    const [isPanning, setIsPanning] = useState<boolean>(false);

    const renderPlace = (time: number) => {
        // put image data
        const shouldDraw = previousTimeRef.current === null
            || time - previousTimeRef.current > DRAW_RATE_MS;

        if (!shouldDraw) {
            animateRequestRef.current = requestAnimationFrame(renderPlace);
            return;
        }

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d') as CanvasRenderingContext2D

        let placeClient = PlaceClient.getInstance();

        if (placeClient.updatesQueue.length > 0) {
            // console.log("Processing Updates: ", placeClient.updatesQueue.length);
        }

        while (placeClient.updatesQueue.length > 0) {
            let update = placeClient.updatesQueue.pop();

            // console.log("Draw: ", update.x, update.y, update.width, update.height);
            let imageData = new ImageData(update.image, update.width, update.height, { colorSpace: "srgb" });
            context.putImageData(imageData, update.x, update.y, 0, 0, update.width, update.height);
        }

        // Setup Next Frame
        previousTimeRef.current = time;
        animateRequestRef.current = requestAnimationFrame(renderPlace);
    }

    useEffect(() => {

        animateRequestRef.current = requestAnimationFrame(renderPlace)

        let placeClient = PlaceClient.getInstance();

        placeClient.fetchAllPatches();

        const canvas = canvasRef.current; // TODO(will): how to cast?
        const context = canvas.getContext('2d') as CanvasRenderingContext2D

        // NOTE(will): This seems to be taken care of via css imageRendering: 'pixelated'
        // but leaving here in case needed 
        // context.imageSmoothingEnabled = false;
        // context.webkitImageSmoothingEnabled = false;
        // context.mozImageSmoothingEnabled = false;
        // context.msImageSmoothingEnabled = false;
        // context.oImageSmoothingEnabled = false;

        context.fillStyle = '#FFFFFF'
        context.fillRect(0, 0, context.canvas.width, context.canvas.height)

        return () => {
            if (animateRequestRef.current !== null) {
                cancelAnimationFrame(animateRequestRef.current);
            }
        }
    }, []);

    const onMouseWheel = (event: WheelEvent) => {
        // console.log("dx ", event.deltaX, " dy ", event.deltaY, " dz ", event.deltaZ)
        let newScale = scale + (scale * (-event.deltaY / 1000))
        newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale))
        setScale(newScale)
    }

    const onMouseDown = (event: MouseEvent) => {
        console.log("mouse down");
        prevMousePos.current = [event.x, event.y];
        setIsPanning(true);
    }

    const onMouseMove = (event: MouseEvent) => {
        if (!isPanning) return;

        const scaledMovementX = event.movementX / scale;
        const scaledMovementY = event.movementY / scale;

        const newXTrans = (canvasTranslation[0] + scaledMovementX);
        const newYTrans = (canvasTranslation[1] + scaledMovementY);
        if (!isNaN(newXTrans) && !isNaN(newYTrans)) {
            setCanvasTranslation([newXTrans, newYTrans])
        }

        prevMousePos.current = [event.x, event.y];
    }

    const onMouseUp = (event: MouseEvent) => {
        console.log("mouse up");
        setIsPanning(false);
    }

    const onDragOver = (event: DragEvent) => {
        // this looks strange but apparently the default is not to allow the
        // drop event, and doing this prevents that.
        event.preventDefault();

        // TODO(will): Figure out how to style this with dataTransfer.setDragImage
        // const draggedColor = event.dataTransfer?.getData("text/plain")
    }

    const onDrop = async (event: DragEvent) => {
        const droppedColor = event.dataTransfer?.getData("text/plain")
        console.log("Dropped Color: ", droppedColor);
        // NOTE(will): So these offsets give us the coordinates we want within the canvs
        // but unfortunately, they are rounded integers, the effect of this is that
        // only dropping in the top left of a pixel is rounded to the correct coordinates
        // I don't see floats anywhere on this object so unsure how to resolve this at the moment. 


        // NOTE(will): subtracting 1 works here because I am offseting the canvas by 0.5 on top and left
        let eventX = event.nativeEvent.offsetX as number - 1;
        let eventY = event.nativeEvent.offsetY as number - 1;
        console.log("drop location: ", eventX, ",", eventY);

        if (publicKey === null) return;

        let client = PlaceClient.getInstance();

        let sortedTokenResults = client.getSortedGameplayTokenResultsForOwner(publicKey);

        console.log("got sorted results: ", sortedTokenResults.length);

        if (sortedTokenResults === undefined || sortedTokenResults.length == 0) return;

        let tokenResult = sortedTokenResults[0];

        if (client.currentSlot === null) {
            console.log("we don't know what slot it is!");
            return;
        }

        if (tokenResult.gameplayTokenAccount === null || tokenResult.tokenAccount === null) {
            console.log("bad result, something was null");
            return;
        }

        if (tokenResult.gameplayTokenAccount.data.update_allowed_slot.gt(new BN(client.currentSlot))) {
            console.log("Token not ready for update");
            return;
        }

        let pixelParams = {
            x: eventX,
            y: eventY,
            pixel: PlaceClient.getInstance().pixelColorToPalletColor(droppedColor),
            payer: publicKey,
            gameplay_token_meta_acct: tokenResult.gameplayTokenAccount.pubkey,
            gameplay_token_acct: tokenResult.tokenAccount.pubkey,
        }

        // set the gameplay token account and shit

        let ix = await PlaceProgram.setPixel(pixelParams);
        let tx = new Transaction().add(ix);
        let sig = await sendTransaction(tx, connection);
        let result = await connection.confirmTransaction(sig, "confirmed");
        console.log(result)

        // Refresh the token cache (not convinced this is 100% reliable)
        client.refreshGameplayToken(publicKey, tokenResult.gameplayTokenAccount);
    }

    return (
        <div className="TapestryCanvas_Container">
            <img ref={dragImageRef} id="dragimage" hidden={true}></img>
            <div style={{
                transform: "scale(" + scale + "," + scale + ")",
                width: PLACE_WIDTH,
                height: PLACE_HEIGHT,
            }} >
                <div style={{
                    transform: "translate(" + canvasTranslation[0] + "px," + canvasTranslation[1] + "px)",
                    width: PLACE_WIDTH,
                    height: PLACE_HEIGHT,
                }} >
                    <div style={{
                        // NOTE(will): these are position hacks to deal with the fact that the drop
                        // event gives us a rounded integer
                        width: PLACE_WIDTH + 0.5,
                        height: PLACE_HEIGHT + 0.5,
                        padding: "0.5px 0px 0px 0.5px",
                        margin: 0,
                    }}
                        onDragOver={onDragOver}
                        onDrop={onDrop}>
                        <canvas
                            ref={canvasRef}
                            width={PLACE_WIDTH}
                            height={PLACE_HEIGHT}
                            onWheel={onMouseWheel}
                            onMouseDown={onMouseDown}
                            onMouseUp={onMouseUp}
                            onMouseMove={onMouseMove}
                            onMouseLeave={onMouseUp}
                            style={{
                                margin: 0,
                                padding: 0,
                                imageRendering: "pixelated"
                            }} />
                    </div>
                </div>
            </div>
        </div>
    );
}

// TODO(will): "App" element here is awkward because its nested
export const App: FC = () => {
    return (
        <div className="App">
            <TapestryCanvas />
        </div>
    );
};