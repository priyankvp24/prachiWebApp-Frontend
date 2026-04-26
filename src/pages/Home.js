import React, { useState, useEffect, useRef, useCallback } from "react";
import "./Home.css";

const categories = {
  hearts:    ["❤️", "🩷", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💖", "💗", "💓", "💞", "💕", "💝"],
  cats:      ["🐱", "😺", "😸", "😻", "🐾", "🐈", "🐈‍⬛", "🙀", "😹"],
  flowers:   ["🌸", "🌺", "🌷", "🌹", "💐", "🌼", "🌻", "🪷"],
  sparkles:  ["✨", "🌟", "💫", "⭐", "🌙", "🦋", "🪄", "🎀", "👑", "💎", "🪩", "🫧", "🫶"],
  girly:     ["🥰", "😍", "🤩", "😘", "💅", "🩰", "🎀", "👑", "💄", "👛", "🪞", "🛍️", "🌂", "🩱", "🪭"],
  sweets:    ["🍰", "🧁", "🍭", "🍬", "🍫", "🍩", "🍪", "🎂", "🍮", "🍡", "🍧", "🍨", "🍦", "🥧", "🍯"],
  berries:   ["🍓", "🫐", "🍇", "🍒", "🍑", "🍊", "🍋", "🍌", "🍉", "🍈", "🍎", "🍏", "🫒", "🥭", "🍍"],
  sporty:    ["⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🏉", "🎱", "🏓", "🏸", "🥊", "🏋️", "🚴", "🏊", "🤸", "⛹️", "🧗", "🏆", "🥇", "🎯"],
  bookish:   ["📚", "📖", "📝", "✏️", "🖊️", "📐", "📏", "🔬", "🔭", "🧪", "🧬", "💡", "🎓", "🏫", "📓", "📔", "📒", "📕", "📗", "📘"],
  optometry: ["👁️", "👀", "🕶️", "👓", "🔍", "🔎", "🌈", "💧", "✨", "🩺", "🏥", "💊", "🩹", "🧬", "🔬"],
};
const categoryKeys = Object.keys(categories);

const GRID_SIZE = 12;
const FADE_MS = 1200;
const API_URL = process.env.REACT_APP_API_URL || "";
const SYNC_INTERVAL = 30000;

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const Home = () => {
  const [displayedEmojis, setDisplayedEmojis] = useState(
    categoryKeys.map((cat, i) => {
      const emoji = pickRandom(categories[cat]);
      return { emoji, visible: true, key: `${emoji}-${i}` };
    })
  );
  const emojisRef = useRef(displayedEmojis);
  emojisRef.current = displayedEmojis;

  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const [allPhotos, setAllPhotos] = useState([]);
  const allPhotosRef = useRef([]);
  allPhotosRef.current = allPhotos;

  const [displayedPhotos, setDisplayedPhotos] = useState([]);
  const photosRef = useRef(displayedPhotos);
  photosRef.current = displayedPhotos;
  const reservedPhotos = useRef(new Set());
  const gridSeeded = useRef(false);

  const fetchICloudPhotos = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/icloud/photos`);
      if (!response.ok) return;
      const photos = await response.json();
      const mapped = photos.map((p) => ({ src: p.full_url, id: p.id }));
      setAllPhotos((prev) => {
        const prevIds = new Set(prev.map((p) => p.id));
        const hasNew = mapped.some((p) => !prevIds.has(p.id));
        return hasNew || mapped.length !== prev.length ? mapped : prev;
      });
    } catch (e) {
      console.error("Error fetching iCloud photos:", e);
    }
  }, []);

  useEffect(() => {
    fetchICloudPhotos();
    const interval = setInterval(fetchICloudPhotos, SYNC_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchICloudPhotos]);

  // Seed the grid once when photos first arrive
  useEffect(() => {
    if (allPhotos.length > 0 && !gridSeeded.current) {
      gridSeeded.current = true;
      // Deduplicate by ID before seeding
      const unique = [...new Map(allPhotos.map((p) => [p.id, p])).values()];
      const shuffled = unique.sort(() => Math.random() - 0.5);
      setDisplayedPhotos(
        shuffled.slice(0, GRID_SIZE).map((photo, i) => ({
          ...photo,
          visible: true,
          key: `${photo.id}-${i}-${Date.now()}`,
        }))
      );
    }
  }, [allPhotos]);

  useEffect(() => {
    let cancelled = false;

    const startEmojiCycle = (pos) => {
      const cat = categoryKeys[pos];
      const pool = categories[cat];

      const cycle = () => {
        if (cancelled) return;
        setDisplayedEmojis((prev) =>
          prev.map((item, i) => (i === pos ? { ...item, visible: false } : item))
        );
        setTimeout(() => {
          if (cancelled) return;
          const current = emojisRef.current[pos].emoji;
          const available = pool.filter((e) => e !== current);
          const newEmoji = pickRandom(available.length > 0 ? available : pool);
          setDisplayedEmojis((prev) =>
            prev.map((item, i) =>
              i === pos
                ? { emoji: newEmoji, visible: false, key: `${newEmoji}-${Date.now()}-${pos}` }
                : item
            )
          );
          setTimeout(() => {
            if (cancelled) return;
            setDisplayedEmojis((prev) =>
              prev.map((item, i) => (i === pos ? { ...item, visible: true } : item))
            );
            setTimeout(cycle, 2000 + Math.random() * 3000);
          }, 50);
        }, FADE_MS);
      };

      setTimeout(cycle, Math.random() * 3000);
    };

    const startPhotoCycle = (pos) => {
      const cycle = () => {
        if (cancelled) return;
        setDisplayedPhotos((prev) =>
          prev.map((item, i) => (i === pos ? { ...item, visible: false } : item))
        );
        setTimeout(() => {
          if (cancelled) return;
          // Deduplicate by ID so URL refreshes don't create phantom duplicates
          const currentIds = new Set(photosRef.current.map((item) => item.id));
          const pool = allPhotosRef.current;
          const available = pool.filter(
            (p) => !currentIds.has(p.id) && !reservedPhotos.current.has(p.id)
          );
          const newPhoto = pickRandom(available);
          if (!newPhoto) {
            // No replacement available — restore current photo and retry later
            setDisplayedPhotos((prev) =>
              prev.map((item, i) => (i === pos ? { ...item, visible: true } : item))
            );
            setTimeout(cycle, 15000 + Math.random() * 15000);
            return;
          }
          reservedPhotos.current.add(newPhoto.id);
          setDisplayedPhotos((prev) =>
            prev.map((item, i) =>
              i === pos
                ? { ...newPhoto, visible: false, key: `${newPhoto.id}-${Date.now()}-${pos}` }
                : item
            )
          );
          setTimeout(() => {
            if (cancelled) return;
            reservedPhotos.current.delete(newPhoto.id);
            setDisplayedPhotos((prev) =>
              prev.map((item, i) => (i === pos ? { ...item, visible: true } : item))
            );
            setTimeout(cycle, 10000 + Math.random() * 24000);
          }, 50);
        }, FADE_MS);
      };

      setTimeout(cycle, Math.random() * 4000);
    };

    for (let i = 0; i < 10; i++) startEmojiCycle(i);
    for (let i = 0; i < GRID_SIZE; i++) startPhotoCycle(i);

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="home-layout">
      <div className="left-panel">
        <img src="/pretty_lady.jpeg" alt="pretty lady" className="pretty-lady" />
      </div>
      <div className="right-panel">
        <div className="emoji-display">
          {displayedEmojis.map((item) => (
            <span key={item.key} className={`emoji-item ${item.visible ? "visible" : "hidden"}`}>
              {item.emoji}
            </span>
          ))}
        </div>
        <div className="photo-grid">
          {displayedPhotos.length === 0 ? (
            <p className="loading-photos">Loading photos...</p>
          ) : (
            displayedPhotos.map((item) => (
              <div
                key={item.key}
                className={`photo-container ${item.visible ? "visible" : "hidden"}`}
                onClick={() => item.visible && setSelectedPhoto(item.src)}
              >
                <img src={item.src} alt="" className="grid-photo" />
              </div>
            ))
          )}
        </div>
      </div>

      {selectedPhoto && (
        <div className="photo-modal-overlay" onClick={() => setSelectedPhoto(null)}>
          <div className="photo-modal-content" onClick={(e) => e.stopPropagation()}>
            <img src={selectedPhoto} alt="" className="photo-modal-img" />
            <button className="photo-modal-close" onClick={() => setSelectedPhoto(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
