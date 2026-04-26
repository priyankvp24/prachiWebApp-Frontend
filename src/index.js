import React from 'react';
import ReactDOM from 'react-dom/client'; // Use the new ReactDOM API
import './App.css';
import Main from './Main';

const root = ReactDOM.createRoot(document.getElementById('root')); // Create a root
root.render(<Main />); // Render your application