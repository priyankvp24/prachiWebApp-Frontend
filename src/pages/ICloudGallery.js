import React, { useState, useEffect, useCallback } from 'react';
import './ICloudGallery.css';

const API_BASE_URL = '/api';

const ICloudGallery = () => {
  const [albumUrl, setAlbumUrl] = useState('');
  const [configured, setConfigured] = useState(false);
  const [savedUrl, setSavedUrl] = useState('');
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  // Check current configuration on mount
  useEffect(() => {
    fetchConfiguration();
    fetchPhotos();
  }, []);

  const fetchConfiguration = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/icloud/album`);
      const data = await response.json();
      if (data.configured) {
        setConfigured(true);
        setSavedUrl(data.album_url);
        setLastFetched(data.last_fetched);
      }
    } catch (err) {
      console.error('Error fetching configuration:', err);
    }
  };

  const fetchPhotos = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/icloud/photos`);
      const data = await response.json();
      setPhotos(data);
    } catch (err) {
      console.error('Error fetching photos:', err);
    }
  };

  const handleSaveUrl = async (e) => {
    e.preventDefault();
    if (!albumUrl.trim()) {
      setError('Please enter an album URL');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${API_BASE_URL}/icloud/album`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ album_url: albumUrl }),
      });

      const data = await response.json();

      if (response.ok) {
        setConfigured(true);
        setSavedUrl(albumUrl);
        setSuccess('Album URL saved successfully!');
        setAlbumUrl('');
        // Auto-fetch after saving
        setTimeout(handleFetchPhotos, 500);
      } else {
        setError(data.error || 'Failed to save album URL');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchPhotos = async () => {
    setFetching(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${API_BASE_URL}/icloud/fetch`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Successfully fetched ${data.photos_fetched} photos!`);
        fetchPhotos();
        fetchConfiguration();
      } else {
        setError(data.error || 'Failed to fetch photos');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setFetching(false);
    }
  };

  const handleClear = async () => {
    if (!window.confirm('Are you sure you want to clear all iCloud data?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/icloud/clear`, {
        method: 'POST',
      });

      if (response.ok) {
        setConfigured(false);
        setSavedUrl('');
        setPhotos([]);
        setLastFetched(null);
        setSuccess('All iCloud data cleared');
      }
    } catch (err) {
      setError('Failed to clear data');
    }
  };

  const openLightbox = (photo) => {
    setSelectedPhoto(photo);
  };

  const closeLightbox = () => {
    setSelectedPhoto(null);
  };

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && selectedPhoto) {
      closeLightbox();
    }
  }, [selectedPhoto]);

  useEffect(() => {
    if (selectedPhoto) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedPhoto, handleKeyDown]);

  return (
    <div className="icloud-gallery">
      <div className="gallery-header">
        <h1>📸 iCloud Shared Album Gallery</h1>
        <p className="gallery-description">
          Enter your iCloud Shared Album's public URL to display photos. 
          The album must have "Public Website" enabled.
        </p>
      </div>

      {/* Configuration Section */}
      <div className="config-section">
        {!configured ? (
          <form onSubmit={handleSaveUrl} className="config-form">
            <div className="form-group">
              <label htmlFor="album-url">iCloud Shared Album URL</label>
              <input
                id="album-url"
                type="url"
                value={albumUrl}
                onChange={(e) => setAlbumUrl(e.target.value)}
                placeholder="https://www.icloud.com/sharedalbum/#..."
                disabled={loading}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Album URL & Fetch Photos'}
            </button>
          </form>
        ) : (
          <div className="config-status">
            <div className="status-info">
              <p><strong>Album configured:</strong></p>
              <p className="album-url">{savedUrl}</p>
              {lastFetched && (
                <p className="last-fetched">
                  Last fetched: {new Date(lastFetched).toLocaleString()}
                </p>
              )}
            </div>
            <div className="status-actions">
              <button 
                onClick={handleFetchPhotos} 
                className="btn-primary" 
                disabled={fetching}
              >
                {fetching ? 'Fetching...' : '🔄 Refresh Photos'}
              </button>
              <button onClick={handleClear} className="btn-danger">
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="message error">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="message-close">×</button>
        </div>
      )}
      {success && (
        <div className="message success">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="message-close">×</button>
        </div>
      )}

      {/* Photo Gallery */}
      <div className="gallery-section">
        <h2>Photo Gallery</h2>
        {photos.length === 0 ? (
          <div className="no-photos">
            {configured 
              ? 'No photos found. Click "Refresh Photos" to get photos from the album.'
              : 'Configure an album URL above to get started.'}
          </div>
        ) : (
          <div className="photo-grid">
            {photos.map((photo) => (
              <div 
                key={photo.id} 
                className="photo-card"
                onClick={() => openLightbox(photo)}
              >
                {photo.thumbnail_url ? (
                  <img 
                    src={photo.thumbnail_url} 
                    alt={photo.filename}
                    loading="lazy"
                    onError={(e) => {
                      e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
                    }}
                  />
                ) : (
                  <div className="photo-placeholder">
                    <span>📷</span>
                    <span>{photo.filename}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {selectedPhoto && (
        <div className="lightbox" onClick={closeLightbox}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={closeLightbox}>×</button>
            {selectedPhoto.full_url ? (
              <img 
                src={selectedPhoto.full_url} 
                alt={selectedPhoto.filename}
              />
            ) : (
              <div className="no-image">No full-size image available</div>
            )}
            <div className="lightbox-info">
              <p className="filename">{selectedPhoto.filename}</p>
              {selectedPhoto.fetched_at && (
                <p className="fetched">
                  Added: {new Date(selectedPhoto.fetched_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ICloudGallery;