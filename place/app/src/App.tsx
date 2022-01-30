import React, { FC } from 'react';
import { PlaceClient } from '@tapestrydao/place-client'

export const TapestryCanvas: FC = () => {
    let thing = PlaceClient.getInstance();
    thing.subscribeToPatchUpdates();
    return <></>
}

export const App: FC = () => {
    return (
        <div className="App">
            <TapestryCanvas />
        </div>
    );
};