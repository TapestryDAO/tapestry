import React, { FC, useEffect, useRef } from 'react';
import { PlaceClient } from '@tapestrydao/place-client'

const DRAW_RATE_MS = 1000 / 10

export const TapestryCanvas: FC = (props) => {
    let thing = PlaceClient.getInstance();
    thing.subscribeToPatchUpdates();

    const canvasRef = useRef(null);
    const animateRequestRef = useRef<number>(null);
    const previousTimeRef = useRef<number>(null);

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
        context.imageSmoothingEnabled = false;

        let placeClient = PlaceClient.getInstance();

        if (placeClient.updatesQueue.length > 0) {
            console.log("Processing Updates: ", placeClient.updatesQueue.length);
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
        context.imageSmoothingEnabled = false;
        context.fillStyle = '#FF0000'
        console.log("FILLING");
        context.fillRect(0, 0, context.canvas.width, context.canvas.height)

        return () => {
            if (animateRequestRef.current !== null) {
                cancelAnimationFrame(animateRequestRef.current);
            }
        }
    }, []);

    // useEffect(() => {
    //     const canvas = canvasRef.current; // TODO(will): how to cast?
    //     const context = canvas.getContext('2d') as CanvasRenderingContext2D
    //     context.imageSmoothingEnabled = false;

    //     context.fillStyle = '#FF0000'
    //     context.fillRect(0, 0, context.canvas.width, context.canvas.height)
    // })

    return (
        <div style={{ scale: "1, 1" }} >
            <canvas ref={canvasRef} width={1920} height={1080} />
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