import {createRoot} from 'react-dom/client';
import PopupView from "../components/popupView";
import * as React from 'react';

const rootElement = document.querySelector('#main');

if (rootElement) {
    createRoot(rootElement).render(<PopupView/>);
}
