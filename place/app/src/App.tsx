import React, { FC, useEffect, useRef } from 'react';
import { PlaceClient } from '@tapestrydao/place-client'

export const TapestryCanvas: FC = (props) => {
    let thing = PlaceClient.getInstance();
    thing.subscribeToPatchUpdates();

    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current; // TODO(will): how to cast?
        const context = canvas.getContext('2d') as CanvasRenderingContext2D
        context.imageSmoothingEnabled = false;

        context.fillStyle = '#FF0000'
        context.fillRect(0, 0, context.canvas.width, context.canvas.height)
    })

    return (
        <div style={{ scale: "1,1" }} >
            <canvas ref={canvasRef} width={1920} height={1080} />
        </div>
    }
}

export const App: FC = () => {
    return (
        <div className="App">
            <TapestryCanvas />
        </div>
    );
};