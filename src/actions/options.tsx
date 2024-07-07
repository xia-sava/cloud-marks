import {createRoot} from 'react-dom/client';
import OptionsView from "../components/optionsView";
import * as React from 'react';

const rootElement = document.querySelector('#main');

if (rootElement) {
    createRoot(rootElement).render(<OptionsView/>);
}
