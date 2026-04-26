import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Garden from './pages/Garden';
import ToDo from './pages/ToDo';
import Schedule from './pages/Schedule';
import Links from './pages/Links';
import ICloudGallery from './pages/ICloudGallery';

function Main() {
  return (
    <Router>
      <div className="tabs-container">
        <Link to="/" className="name">Jane Doe</Link>
        <Link to="/garden" className="tab">🌸 Garden</Link>
        <Link to="/todo" className="tab">🗒️ To-Do</Link>
        <Link to="/schedule" className="tab">📅 Schedule</Link>
        <Link to="/links" className="tab">🌐 Links</Link>
        <Link to="/gallery" className="tab">📸 Gallery</Link>
      </div>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/garden" element={<Garden />} />
        <Route path="/todo" element={<ToDo />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/links" element={<Links />} />
        <Route path="/gallery" element={<ICloudGallery />} />
      </Routes>
    </Router>
  );
}

export default Main;