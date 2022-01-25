import React, { FC } from 'react';
import { KonvaTapestry } from './Tapestry'
import { PatchModalProvider } from './TapestryModal';
import { Floater } from './Floater';

export const App: FC = () => {
  return (
    <div className="App">
      <PatchModalProvider>
        <KonvaTapestry />
        <Floater />
      </PatchModalProvider>
    </div>
  );
};