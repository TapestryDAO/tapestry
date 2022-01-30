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

        console.log("DRAW!");

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d') as CanvasRenderingContext2D
        context.imageSmoothingEnabled = false;
        previousTimeRef.current = time;
        animateRequestRef.current = requestAnimationFrame(animate);
    }

    useEffect(() => {

        animateRequestRef.current = requestAnimationFrame(animate)

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
        <div style={{ scale: "1,1" }} >
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