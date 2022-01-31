import React, { FC, useEffect, useRef, useState } from 'react';
import { PlaceClient } from '@tapestrydao/place-client'

const DRAW_RATE_MS = 1000 / 10
const MAX_SCALE = 40
const MIN_SCALE = 0.5

export const TapestryCanvas: FC = (props) => {
    let thing = PlaceClient.getInstance();
    thing.subscribeToPatchUpdates();

    const canvasRef = useRef(null);
    const animateRequestRef = useRef<number>(null);
    const previousTimeRef = useRef<number>(null);
    const prevMousePos = useRef<number[]>([0, 0])

    const [scale, setScale] = useState<number>(1);
    const [canvasTranslation, setCanvasTranslation] = useState<number[]>([0, 0]);
    const [isDraggingCanvas, setIsDraggingCanvas] = useState<boolean>(false);

    const animate = (time: number) => {
        // put image data
        const shouldDraw = previousTimeRef.current === null
            || time - previousTimeRef.current > DRAW_RATE_MS;

        if (!shouldDraw) {
            animateRequestRef.current = requestAnimationFrame(animate);
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
        animateRequestRef.current = requestAnimationFrame(animate);
    }

    useEffect(() => {

        animateRequestRef.current = requestAnimationFrame(animate)

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
        setIsDraggingCanvas(true);
    }

    const onMouseMove = (event: MouseEvent) => {
        if (!isDraggingCanvas) return;


        const newXTrans = (canvasTranslation[0] + event.movementX);
        const newYTrans = (canvasTranslation[1] + event.movementY);
        if (!isNaN(newXTrans) && !isNaN(newYTrans)) {
            setCanvasTranslation([newXTrans, newYTrans])
        }

        prevMousePos.current = [event.x, event.y];
    }

    const onMouseUp = (event: MouseEvent) => {
        console.log("mouse up");
        setIsDraggingCanvas(false);
    }

    return (
        <div style={{ transform: "scale(" + scale + "," + scale + ")" }} >
            <div style={{ transform: "translate(" + canvasTranslation[0] + "px," + canvasTranslation[1] + "px)" }} >
                <canvas
                    ref={canvasRef}
                    width={1920}
                    height={1080}
                    onWheel={onMouseWheel}
                    onMouseDown={onMouseDown}
                    onMouseUp={onMouseUp}
                    onMouseMove={onMouseMove}
                    onMouseLeave={onMouseUp}
                    style={{
                        imageRendering: "pixelated"
                    }} />
            </div>
        </div>
    );
}

export const App: FC = () => {
    return (
        <div className="App">
            <TapestryCanvas />
        </div>
    );
};