import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

/*
  TravelJournalSite
  -----------------
  This component creates a retro desktop-style travel journal.

  Main ideas:
  - Desktop icons can be dragged around.
  - Double-clicking an icon opens a draggable window.
  - Each window type renders different editable content.
  - Data is saved automatically to localStorage.
  - The map is loaded dynamically only in the browser to avoid SSR issues.
*/

const STORAGE_KEY = 'travel-journal-desktop-items';

const ICON_OPTIONS = [
  '📁',
  '❤️',
  '📸',
  '🖼️',
  '💌',
  '⭐',
  '🧳',
  '🎞️',
  '🧭',
  '🌍',
  '✈️',
  '🌴',
  '🗺️',
  '🎵',
  '📅',
  '📖',
  '🔒',
];

const TYPE_OPTIONS = ['text', 'list', 'image', 'video-library'];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const createId = (prefix = 'id') =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const makeDefaultContent = (type, label = 'New item') => {
  switch (type) {
    case 'text':
      return { text: `Write here for ${label}...` };
    case 'list':
      return {
        items: [{ id: `i-${Date.now()}`, text: `${label} item`, done: false }],
      };
    case 'image':
      return { images: [] };
    case 'video-library':
      return { videos: [], currentVideoId: null };
    case 'travel-blog':
      return {
        posts: [],
        selectedPostId: null,
      };
    default:
      return { text: 'New memory...' };
  }
};
const toEmbedUrl = (value) => {
  const input = value.trim();

  if (!input) return '';
  if (input.includes('youtube.com/embed/')) return input;

  const watchMatch = input.match(/[?&]v=([^&]+)/);
  if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}`;

  const shortMatch = input.match(/youtu\.be\/([^?&]+)/);
  if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`;

  // Fallback: return the input as-is. This allows custom embed URLs too.
  return input;
};

const addOneMonth = (date) => {
  const newDate = new Date(date);
  newDate.setMonth(newDate.getMonth() + 1);
  return newDate;
};

const formatDeadline = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const createMapIcon = (L, background, size = 18) =>
  new L.DivIcon({
    className: 'custom-marker',
    html: `<div style="background:${background};border:2px solid black;width:${size}px;height:${size}px;border-radius:999px;box-shadow:2px 2px 0 #000"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

const INITIAL_DESKTOP_ITEMS = [
  {
    id: 'welcome',
    label: 'Welcome.txt',
    icon: '🖥️',
    x: 70,
    y: 110,
    windowX: 120,
    windowY: 80,
    windowTitle: 'Welcome.txt',
    type: 'welcome',
    content: {
      text: 'Welcome to our little retro corner. This can be your soft digital diary for memories, photos, notes, and all the beautiful moments you want to keep forever.',
    },
    protected: true,
  },
  {
    id: 'travel-blog',
    label: 'Travel Blog',
    icon: '📰',
    x: 1090,
    y: 120,
    windowX: 180,
    windowY: 90,
    windowTitle: 'Travel Blog',
    type: 'travel-blog',
    content: {
      posts: [
        {
          id: 'blog-1',
          title: 'Italy 2026',
          route: 'Florence → Pisa → La Spezia → Portovenere',
          hotels: 'Hotel in Florence, apartment in La Spezia',
          transport: 'Flight + train + bus',
          learned: 'Traveling light makes everything easier.',
          funny: 'We almost took the wrong train platform.',
          photos: [
            'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?auto=format&fit=crop&w=1200&q=80',
          ],
          videos: ['https://www.youtube.com/embed/dQw4w9WgXcQ'],
          createdAt: new Date().toLocaleDateString('en-GB'),
        },
      ],
      selectedPostId: 'blog-1',
    },
    protected: false,
  },
  {
    id: 'trips',
    label: 'Trips',
    icon: '📁',
    x: 210,
    y: 120,
    windowX: 170,
    windowY: 110,
    windowTitle: 'Trips',
    type: 'trips',
    content: {
      trips: [
        { id: 'trip-1', name: 'Italy 2026', date: '2026-04-12', todo: ['Book dinner', 'Save best photos'] },
        { id: 'trip-2', name: 'Beach escape', date: '2026-06-20', todo: ['Pack sunglasses'] },
      ],
    },
    protected: false,
  },
  {
    id: 'photos',
    label: 'Photos.jpg',
    icon: '🖼️',
    x: 100,
    y: 255,
    windowX: 220,
    windowY: 130,
    windowTitle: 'Photos.jpg',
    type: 'photos',
    content: {
      images: [
        {
          id: 'photo-1',
          url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
          favorite: false,
        },
        {
          id: 'photo-2',
          url: 'https://images.unsplash.com/photo-1493558103817-58b2924bce98?auto=format&fit=crop&w=1200&q=80',
          favorite: true,
        },
      ],
    },
    protected: false,
  },
  {
    id: 'video',
    label: 'Video.mov',
    icon: '📼',
    x: 240,
    y: 280,
    windowX: 250,
    windowY: 100,
    windowTitle: 'Video.mov',
    type: 'video-library',
    content: {
      videos: [
        {
          id: 'video-1',
          title: 'Travel video',
          url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        },
      ],
      currentVideoId: 'video-1',
    },
    protected: false,
  },
  {
    id: 'letters',
    label: 'Letters.doc',
    icon: '💌',
    x: 385,
    y: 125,
    windowX: 200,
    windowY: 120,
    windowTitle: 'Letters.doc',
    type: 'letters',
    content: {
      letters: [
        {
          id: 'letter-1',
          title: 'For a cozy day',
          body: 'I love this little corner we are building together.',
          date: '2026-04-23',
        },
      ],
      featuredLetterId: 'letter-1',
    },
    protected: false,
  },
  {
    id: 'next-destination',
    label: 'Next Destination',
    icon: '🧭',
    x: 530,
    y: 170,
    windowX: 260,
    windowY: 120,
    windowTitle: 'Next Destination',
    type: 'countdown',
    content: {
      message: 'Countdown until Sunday at 23:59',
      reveal: 'Ibiza 🏝️',
      checklist: [
        { id: 'todo-1', text: 'Pack swimwear', done: false },
        { id: 'todo-2', text: 'Download playlists', done: true },
      ],
    },
    protected: false,
  },
  {
    id: 'wishlist',
    label: 'Dreams.txt',
    icon: '⭐',
    x: 385,
    y: 260,
    windowX: 300,
    windowY: 140,
    windowTitle: 'Dreams.txt',
    type: 'dreams',
    content: {
      dreams: [
        { id: 'dream-1', text: 'Japan in spring', priority: 'High', done: false },
        { id: 'dream-2', text: 'Iceland roadtrip', priority: 'Medium', done: false },
      ],
    },
    protected: false,
  },

  {
    id: 'random-dates',
    label: 'Random Dates',
    icon: '🎲',
    x: 760,
    y: 260,
    windowX: 220,
    windowY: 120,
    windowTitle: 'Random Dates',
    type: 'random-dates',
    content: {
      ideas: [
        'Cooking date',
        'Lego date',
        'Bowling date',
        'Netflix + fav snacks date',
        'Spa date',
        'Pottery date',
        'Workshop date',
        'City trip date',
        'Road trip to a random place',
        'Arcade date',
        'Theme park date',
        'Photography date',
        'Bookstore + coffee date',
        'Picnic date',
        'Sunset viewpoint date',
        'Dessert hopping date',
        'Wine tasting date',
        'Beer tasting date',
        'Michelin star date',
        'Board games cafe date',
        'Custom t-shirt / tote bag date',
        'Trivia night / pub quiz date',
        'Movie marathon date',
        'Dance date',
        'Blindfold guessing date',
      ],
      lastResult: null,
      history: [],
    },
    protected: false,
  },

  {
    id: 'world-map',
    label: 'World Map.exe',
    icon: '🗺️',
    x: 760,
    y: 140,
    windowX: 140,
    windowY: 70,
    windowTitle: 'World Map',
    type: 'map',
    content: {
      visited: [
        { id: 'v-1', name: 'Netherlands 🇳🇱', position: [52.1326, 5.2913] },
        { id: 'v-2', name: 'Spain 🇪🇸', position: [40.4637, -3.7492] },
        { id: 'v-3', name: 'Italy 🇮🇹', position: [41.8719, 12.5674] },
      ],
      dream: [
        { id: 'd-1', name: 'Japan 🇯🇵', position: [36.2048, 138.2529] },
        { id: 'd-2', name: 'Iceland 🇮🇸', position: [64.9631, -19.0208] },
        { id: 'd-3', name: 'Greece 🇬🇷', position: [39.0742, 21.8243] },
      ],
      next: { id: 'n-1', name: 'Ibiza 🏝️', position: [38.9067, 1.4206] },
    },
    protected: false,
  },
  {
    id: 'creator',
    label: 'Create Icon.exe',
    icon: '➕',
    x: 650,
    y: 120,
    windowX: 320,
    windowY: 110,
    windowTitle: 'Create Icon',
    type: 'creator',
    content: {},
    protected: true,
  },
  {
    id: 'music-player',
    label: 'Music Player',
    icon: '🎵',
    x: 870,
    y: 120,
    windowX: 360,
    windowY: 90,
    windowTitle: 'Music Player',
    type: 'music',
    content: {
      tracks: [
        {
          id: 'track-1',
          title: 'Dreamy ambient',
          url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        },
      ],
      currentTrackId: 'track-1',
    },
    protected: false,
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: '📅',
    x: 980,
    y: 120,
    windowX: 390,
    windowY: 120,
    windowTitle: 'Calendar',
    type: 'calendar',
    content: {
      events: [
        { id: 'event-1', title: 'Trip countdown ends', date: '2026-04-26' },
        { id: 'event-2', title: 'Next weekend plan', date: '2026-05-02' },
      ],
    },
    protected: false,
  },
  {
    id: 'guestbook',
    label: 'Guestbook',
    icon: '📖',
    x: 870,
    y: 240,
    windowX: 430,
    windowY: 150,
    windowTitle: 'Guestbook',
    type: 'guestbook',
    content: {
      entries: [{ id: 'entry-1', text: 'A tiny memory worth keeping.', date: '2026-04-23 18:00' }],
    },
    protected: false,
  },
  {
    id: 'secrets',
    label: 'Secrets',
    icon: '🔒',
    x: 980,
    y: 240,
    windowX: 460,
    windowY: 180,
    windowTitle: 'Secrets',
    type: 'secrets',
    content: {
      password: 'ibiza',
      unlocked: false,
      notes: ['Open when you want a surprise 💗'],
    },
    protected: false,
  },
];

function DraggableWindow({ item, onClose, children, onUpdatePosition }) {
  /*
    Ventana arrastrable:
    - windowRef apunta a la ventana.
    - offsetRef guarda dónde has clicado dentro de la ventana.
    - IMPORTANTÍSIMO:
      como la ventana está dentro del desktop, hay que restar la posición
      del contenedor padre. Si no, la ventana salta a la derecha.
  */

  const windowRef = useRef(null);
  const draggingRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!draggingRef.current || !windowRef.current) return;

      const parent = windowRef.current.offsetParent;
      const parentRect = parent
        ? parent.getBoundingClientRect()
        : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

      const newX = e.clientX - parentRect.left - offsetRef.current.x;
      const newY = e.clientY - parentRect.top - offsetRef.current.y;

      onUpdatePosition(item.id, {
        windowX: Math.max(20, Math.min(newX, parentRect.width - 220)),
        windowY: Math.max(20, Math.min(newY, parentRect.height - 120)),
      });
    };

    const onMouseUp = () => {
      draggingRef.current = false;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [item.id, onUpdatePosition]);

  const startWindowDrag = (e) => {
    e.preventDefault();

    if (!windowRef.current) return;

    draggingRef.current = true;

    const rect = windowRef.current.getBoundingClientRect();

    offsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  return (
    <div
      ref={windowRef}
      className="absolute z-40 w-full max-w-4xl border-4 border-black bg-[#efefef] shadow-[8px_8px_0_0_#000]"
      style={{
        left: item.windowX ?? 120,
        top: item.windowY ?? 80,
      }}
    >
      <div
        className="flex cursor-move items-center justify-between border-b-4 border-black bg-[#000080] px-4 py-2 text-white"
        onMouseDown={startWindowDrag}
      >
        <div className="flex items-center gap-2">
          <span>{item.icon}</span>
          <h2 className="text-sm font-bold">{item.windowTitle}</h2>
        </div>
      
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onClose}
          aria-label="Close window"
          className="flex h-9 w-9 items-center justify-center border-2 border-black bg-[#d9d9d9] text-base font-bold text-black shadow-[2px_2px_0_0_#000] hover:bg-[#ffb3b3]"
        >
          X
      </button>

      </div>

      <div className="max-h-[72vh] overflow-auto p-5">{children}</div>
    </div>
  );
}

export default function TravelJournalSite() {
  const [countdown, setCountdown] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [mapLib, setMapLib] = useState(null);

  const [creatorName, setCreatorName] = useState('');
  const [creatorIcon, setCreatorIcon] = useState('📁');
  const [creatorType, setCreatorType] = useState('text');

  const [tripName, setTripName] = useState('');
  const [tripDate, setTripDate] = useState('');
  const [tripTodo, setTripTodo] = useState('');

  const [photoUrl, setPhotoUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  const [letterTitle, setLetterTitle] = useState('');
  const [letterBody, setLetterBody] = useState('');

  const [dreamName, setDreamName] = useState('');
  const [dreamPriority, setDreamPriority] = useState('Medium');

  const [destinationTodo, setDestinationTodo] = useState('');

  const [trackTitle, setTrackTitle] = useState('');
  const [trackUrl, setTrackUrl] = useState('');

  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');

  const [guestbookText, setGuestbookText] = useState('');

  const [secretPasswordInput, setSecretPasswordInput] = useState('');
  const [secretNote, setSecretNote] = useState('');

  const [blogTitle, setBlogTitle] = useState('');
  const [blogRoute, setBlogRoute] = useState('');
  const [blogHotels, setBlogHotels] = useState('');
  const [blogTransport, setBlogTransport] = useState('');
  const [blogLearned, setBlogLearned] = useState('');
  const [blogFunny, setBlogFunny] = useState('');
  const [blogPhotoUrl, setBlogPhotoUrl] = useState('');
  const [blogVideoUrl, setBlogVideoUrl] = useState('');
  const [blogDraftPhotos, setBlogDraftPhotos] = useState([]);
  const [blogDraftVideos, setBlogDraftVideos] = useState([]);

  const [mapPlaceName, setMapPlaceName] = useState('');
  const [mapLat, setMapLat] = useState('');
  const [mapLng, setMapLng] = useState('');
  const [mapCategory, setMapCategory] = useState('dream');

  const [rouletteState, setRouletteState] = useState({
  spinning: false,
  rotation: 0,
});

const iconOptions = [
  '📁',
  '❤️',
  '📸',
  '🖼️',
  '💌',
  '⭐',
  '🧳',
  '🎞️',
  '🧭',
  '🌍',
  '✈️',
  '🌴',
  '🗺️',
  '🎵',
  '📅',
  '📖',
  '🔒',
  '📰',
  '🎲',
];
const typeOptions = ['text', 'list', 'image', 'video-library', 'travel-blog'];

  // Start with static data. Saved data is loaded later in an effect to avoid SSR/localStorage errors.
  const [desktopItems, setDesktopItems] = useState(INITIAL_DESKTOP_ITEMS);
  const [activeItemId, setActiveItemId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);

  const hasLoadedStorageRef = useRef(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || hasLoadedStorageRef.current) return;

    try {
      const savedItems = localStorage.getItem(STORAGE_KEY);
      if (savedItems) setDesktopItems(JSON.parse(savedItems));
    } catch (error) {
      console.error('Error loading saved desktop items:', error);
    } finally {
      hasLoadedStorageRef.current = true;
    }
  }, [isClient]);

  useEffect(() => {
    if (!isClient || !hasLoadedStorageRef.current) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(desktopItems));
    } catch (error) {
      console.error('Error saving desktop items:', error);
    }
  }, [desktopItems, isClient]);

  useEffect(() => {
    if (!isClient) return;

    let mounted = true;

    const loadMapLibs = async () => {
      try {
        // Leaflet depends on browser APIs, so it is imported dynamically on the client only.
        const reactLeaflet = await import('react-leaflet');
        const leaflet = await import('leaflet');
        const L = leaflet.default ?? leaflet;

        if (!mounted) return;

        setMapLib({
          ...reactLeaflet,
          greenIcon: createMapIcon(L, '#86efac'),
          yellowIcon: createMapIcon(L, '#fde68a'),
          pinkIcon: createMapIcon(L, '#f9a8d4', 20),
        });
      } catch (error) {
        console.error('Error loading map libraries:', error);
      }
    };

    loadMapLibs();

    return () => {
      mounted = false;
    };
  }, [isClient]);

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const target = new Date(now);
      const day = now.getDay();
      const daysUntilSunday = day === 0 ? 0 : 7 - day;

      target.setDate(now.getDate() + daysUntilSunday);
      target.setHours(23, 59, 0, 0);

      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown('It is time ✨');
        return;
      }

      const totalSeconds = Math.floor(diff / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, []);

  const activeItem = useMemo(
    () => desktopItems.find((item) => item.id === activeItemId) ?? null,
    [desktopItems, activeItemId]
  );

  const deletableItems = useMemo(
    () => desktopItems.filter((item) => !item.protected),
    [desktopItems]
  );

  const updateItem = useCallback((id, patch) => {
    setDesktopItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }, []);

  const updateItemContent = useCallback((id, updater) => {
    setDesktopItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              content: typeof updater === 'function' ? updater(item.content) : updater,
            }
          : item
      )
    );
  }, []);

  const startDrag = useCallback((event, id) => {
    event.dataTransfer.setData('text/plain', id);
    event.dataTransfer.effectAllowed = 'move';
    setDraggingId(id);
  }, []);

  const onDesktopDrop = useCallback((event) => {
    event.preventDefault();

    const id = event.dataTransfer.getData('text/plain');
    if (!id) return;

    const desktopRect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - desktopRect.left - 40;
    const y = event.clientY - desktopRect.top - 30;

    setDesktopItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              x: clamp(x, 16, desktopRect.width - 90),
              y: clamp(y, 70, desktopRect.height - 90),
            }
          : item
      )
    );

    setDraggingId(null);
  }, []);

  const addNewIcon = useCallback(() => {
    const name = creatorName.trim();
    if (!name) return;

    const newItem = {
      id: createId('desktop'),
      label: name,
      icon: creatorIcon || '📁',
      x: 200,
      y: 200,
      windowX: 260,
      windowY: 120,
      windowTitle: name,
      type: creatorType,
      content: makeDefaultContent(creatorType, name),
      protected: false,
    };

    setDesktopItems((prev) => [...prev, newItem]);
    setCreatorName('');
    setCreatorIcon('📁');
    setCreatorType('text');
  }, [creatorIcon, creatorName, creatorType]);

  const requestDeleteIcon = useCallback(() => {
    if (!deleteTargetId) return;
    setShowDeleteConfirm(true);
  }, [deleteTargetId]);

  const confirmDeleteIcon = useCallback(() => {
    const target = desktopItems.find((item) => item.id === deleteTargetId);

    if (!target || target.protected) {
      setShowDeleteConfirm(false);
      setDeleteTargetId('');
      return;
    }

    setDesktopItems((prev) => prev.filter((item) => item.id !== deleteTargetId));

    if (activeItemId === deleteTargetId) {
      setActiveItemId(null);
    }

    setShowDeleteConfirm(false);
    setDeleteTargetId('');
  }, [activeItemId, deleteTargetId, desktopItems]);

  const renderWindowContent = (item) => {
    if (!item) return null;

    if (item.type === 'welcome') {
      return (
        <div className="space-y-4 text-black">
          <p className="text-sm font-bold">Welcome message</p>
          <textarea
            value={item.content.text}
            onChange={(event) =>
              updateItemContent(item.id, (prev) => ({ ...prev, text: event.target.value }))
            }
            className="min-h-[180px] w-full border-2 border-black p-3 outline-none"
          />
          <div className="border-2 border-black bg-[#fff6b3] p-3 text-sm shadow-[2px_2px_0_0_#000]">
            Saved automatically.
          </div>
        </div>
      );
    }

    if (item.type === 'travel-blog') {
      const selectedPost =
        item.content.posts.find((post) => post.id === item.content.selectedPostId) ??
        item.content.posts[0] ??
        null;

      return (
        <div className="space-y-6 text-black">
          <div className="border-4 border-black bg-[#d9ecff] p-4 shadow-[4px_4px_0_0_#000]">
            <h3 className="text-lg font-bold">📰 Travel Blog</h3>
            <p className="mt-2 text-sm">
              Save your completed trips with route, hotels, transport, lessons learned,
              funny moments, photos, and videos.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={blogTitle}
              onChange={(e) => setBlogTitle(e.target.value)}
              placeholder="Trip title"
              className="border-2 border-black px-3 py-2 outline-none"
            />

            <input
              value={blogTransport}
              onChange={(e) => setBlogTransport(e.target.value)}
              placeholder="Transport"
              className="border-2 border-black px-3 py-2 outline-none"
            />
          </div>

          <textarea
            value={blogRoute}
            onChange={(e) => setBlogRoute(e.target.value)}
            placeholder="Route / itinerary"
            className="min-h-[90px] w-full border-2 border-black p-3 outline-none"
          />

          <textarea
            value={blogHotels}
            onChange={(e) => setBlogHotels(e.target.value)}
            placeholder="Hotels you stayed at"
            className="min-h-[90px] w-full border-2 border-black p-3 outline-none"
          />

          <textarea
            value={blogLearned}
            onChange={(e) => setBlogLearned(e.target.value)}
            placeholder="What we learned"
            className="min-h-[90px] w-full border-2 border-black p-3 outline-none"
          />

          <textarea
            value={blogFunny}
            onChange={(e) => setBlogFunny(e.target.value)}
            placeholder="Funny moments"
            className="min-h-[90px] w-full border-2 border-black p-3 outline-none"
          />

          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              value={blogPhotoUrl}
              onChange={(e) => setBlogPhotoUrl(e.target.value)}
              placeholder="Photo URL"
              className="border-2 border-black px-3 py-2 outline-none"
            />
            <button
              onClick={() => {
                if (!blogPhotoUrl.trim()) return;
                setBlogDraftPhotos((prev) => [...prev, blogPhotoUrl]);
                setBlogPhotoUrl('');
              }}
              className="border-2 border-black bg-[#d9d9d9] px-4 py-2 shadow-[2px_2px_0_0_#000]"
            >
              Add Photo
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              value={blogVideoUrl}
              onChange={(e) => setBlogVideoUrl(e.target.value)}
              placeholder="YouTube link"
              className="border-2 border-black px-3 py-2 outline-none"
            />
            <button
              onClick={() => {
                const embedUrl = toEmbedUrl(blogVideoUrl);
                if (!embedUrl) return;
                setBlogDraftVideos((prev) => [...prev, embedUrl]);
                setBlogVideoUrl('');
              }}
              className="border-2 border-black bg-[#d9d9d9] px-4 py-2 shadow-[2px_2px_0_0_#000]"
            >
              Add Video
            </button>
          </div>

          {(blogDraftPhotos.length > 0 || blogDraftVideos.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="border-4 border-black bg-white p-4 shadow-[4px_4px_0_0_#000]">
                <h4 className="font-bold">Photos to save</h4>
                <div className="mt-3 space-y-2">
                  {blogDraftPhotos.map((photo, index) => (
                    <div
                      key={`draft-photo-${index}`}
                      className="flex items-center justify-between gap-3 border-2 border-black bg-[#f6f6f6] px-3 py-2 text-sm"
                    >
                      <span className="truncate">{photo}</span>
                      <button
                        onClick={() =>
                          setBlogDraftPhotos((prev) =>
                            prev.filter((_, photoIndex) => photoIndex !== index)
                          )
                        }
                        className="border-2 border-black bg-[#ffb3b3] px-2 py-1 text-xs"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-4 border-black bg-white p-4 shadow-[4px_4px_0_0_#000]">
                <h4 className="font-bold">Videos to save</h4>
                <div className="mt-3 space-y-2">
                  {blogDraftVideos.map((video, index) => (
                    <div
                      key={`draft-video-${index}`}
                      className="flex items-center justify-between gap-3 border-2 border-black bg-[#f6f6f6] px-3 py-2 text-sm"
                    >
                      <span className="truncate">{video}</span>
                      <button
                        onClick={() =>
                          setBlogDraftVideos((prev) =>
                            prev.filter((_, videoIndex) => videoIndex !== index)
                          )
                        }
                        className="border-2 border-black bg-[#ffb3b3] px-2 py-1 text-xs"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => {
              if (!blogTitle.trim()) return;

              const newId = Date.now().toString();

              updateItemContent(item.id, (prev) => ({
                ...prev,
                posts: [
                  {
                    id: newId,
                    title: blogTitle,
                    route: blogRoute,
                    hotels: blogHotels,
                    transport: blogTransport,
                    learned: blogLearned,
                    funny: blogFunny,
                    photos: blogDraftPhotos,
                    videos: blogDraftVideos,
                    createdAt: new Date().toLocaleDateString('en-GB'),
                  },
                  ...prev.posts,
                ],
                selectedPostId: newId,
              }));

              setBlogTitle('');
              setBlogRoute('');
              setBlogHotels('');
              setBlogTransport('');
              setBlogLearned('');
              setBlogFunny('');
              setBlogPhotoUrl('');
              setBlogVideoUrl('');
              setBlogDraftPhotos([]);
              setBlogDraftVideos([]);
            }}
            className="border-2 border-black bg-[#d9d9d9] px-4 py-2 shadow-[2px_2px_0_0_#000]"
          >
            Save Trip Blog
          </button>

          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <div className="border-4 border-black bg-white p-4 shadow-[4px_4px_0_0_#000]">
              <h4 className="font-bold">Saved trips</h4>

              <div className="mt-4 space-y-3">
                {item.content.posts.length === 0 && (
                  <p className="text-sm">No travel blogs yet.</p>
                )}

                {item.content.posts.map((post) => (
                  <div
                    key={post.id}
                    className="border-2 border-black bg-[#f6f6f6] p-3 shadow-[2px_2px_0_0_#000]"
                  >
                    <p className="font-bold">{post.title}</p>
                    <p className="mt-1 text-xs uppercase">Saved on {post.createdAt}</p>

                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() =>
                          updateItemContent(item.id, (prev) => ({
                            ...prev,
                            selectedPostId: post.id,
                          }))
                        }
                        className="border-2 border-black bg-[#d9d9d9] px-3 py-1 text-sm"
                      >
                        Open
                      </button>

                      <button
                        onClick={() =>
                          updateItemContent(item.id, (prev) => {
                            const filteredPosts = prev.posts.filter((row) => row.id !== post.id);
                            return {
                              ...prev,
                              posts: filteredPosts,
                              selectedPostId: filteredPosts[0]?.id ?? null,
                            };
                          })
                        }
                        className="border-2 border-black bg-[#ffb3b3] px-3 py-1 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-4 border-black bg-white p-5 shadow-[4px_4px_0_0_#000]">
              {!selectedPost ? (
                <p className="text-sm">Select a saved trip to view it here.</p>
              ) : (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-2xl font-bold">{selectedPost.title}</h3>
                    <p className="mt-1 text-xs uppercase">Saved on {selectedPost.createdAt}</p>
                  </div>

                  <div>
                    <h4 className="font-bold">Route / itinerary</h4>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{selectedPost.route || '—'}</p>
                  </div>

                  <div>
                    <h4 className="font-bold">Hotels</h4>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{selectedPost.hotels || '—'}</p>
                  </div>

                  <div>
                    <h4 className="font-bold">Transport</h4>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{selectedPost.transport || '—'}</p>
                  </div>

                  <div>
                    <h4 className="font-bold">What we learned</h4>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{selectedPost.learned || '—'}</p>
                  </div>

                  <div>
                    <h4 className="font-bold">Funny moments</h4>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{selectedPost.funny || '—'}</p>
                  </div>

                  {selectedPost.photos?.length > 0 && (
                    <div>
                      <h4 className="font-bold">Photos</h4>
                      <div className="mt-3 grid gap-4 md:grid-cols-2">
                        {selectedPost.photos.map((photo, index) => (
                          <img
                            key={`${selectedPost.id}-photo-${index}`}
                            src={photo}
                            alt={`${selectedPost.title} ${index + 1}`}
                            className="h-52 w-full border-2 border-black object-cover"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedPost.videos?.length > 0 && (
                    <div>
                      <h4 className="font-bold">Videos</h4>
                      <div className="mt-3 space-y-4">
                        {selectedPost.videos.map((video, index) => (
                          <div
                            key={`${selectedPost.id}-video-${index}`}
                            className="overflow-hidden border-4 border-black shadow-[4px_4px_0_0_#000]"
                          >
                            <iframe
                              className="aspect-video w-full"
                              src={video}
                              title={`${selectedPost.title} video ${index + 1}`}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (item.type === 'text') {
      return (
        <textarea
          value={item.content.text}
          onChange={(event) =>
            updateItemContent(item.id, (prev) => ({ ...prev, text: event.target.value }))
          }
          className="min-h-[220px] w-full border-2 border-black p-3 outline-none"
        />
      );
    }

    if (item.type === 'trips') {
      return (
        <div className="space-y-6 text-black">
          <div className="grid gap-3 md:grid-cols-3">
            <input
              value={tripName}
              onChange={(event) => setTripName(event.target.value)}
              placeholder="Trip name"
              className="border-2 border-black px-3 py-2 outline-none"
            />
            <input
              value={tripDate}
              onChange={(event) => setTripDate(event.target.value)}
              type="date"
              className="border-2 border-black px-3 py-2 outline-none"
            />
            <input
              value={tripTodo}
              onChange={(event) => setTripTodo(event.target.value)}
              placeholder="First checklist item"
              className="border-2 border-black px-3 py-2 outline-none"
            />
          </div>

          <button
            onClick={() => {
              if (!tripName.trim()) return;

              updateItemContent(item.id, (prev) => ({
                ...prev,
                trips: [
                  ...prev.trips,
                  {
                    id: createId('trip'),
                    name: tripName,
                    date: tripDate || 'No date',
                    todo: tripTodo ? [tripTodo] : [],
                  },
                ],
              }));

              setTripName('');
              setTripDate('');
              setTripTodo('');
            }}
            className="border-2 border-black bg-[#d9d9d9] px-4 py-2 shadow-[2px_2px_0_0_#000]"
          >
            Add Trip
          </button>

          <div className="space-y-4">
            {item.content.trips.map((trip) => (
              <div
                key={trip.id}
                className="border-4 border-black bg-white p-4 shadow-[4px_4px_0_0_#000]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold">{trip.name}</h3>
                    <p className="text-sm">{trip.date}</p>
                  </div>
                  <button
                    onClick={() =>
                      updateItemContent(item.id, (prev) => ({
                        ...prev,
                        trips: prev.trips.filter((row) => row.id !== trip.id),
                      }))
                    }
                    className="border-2 border-black bg-[#ffb3b3] px-3 py-1 text-sm shadow-[2px_2px_0_0_#000]"
                  >
                    Delete
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {trip.todo.map((todoItem, index) => (
                    <div
                      key={`${trip.id}-${index}`}
                      className="border-2 border-black bg-[#f6f6f6] px-3 py-2 text-sm"
                    >
                      {todoItem}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (item.type === 'list') {
      return (
        <div className="space-y-3 text-black">
          {item.content.items.map((entry) => (
            <label
              key={entry.id}
              className="flex items-center gap-3 border-2 border-black bg-white px-3 py-2 shadow-[2px_2px_0_0_#000]"
            >
              <input
                type="checkbox"
                checked={entry.done}
                onChange={() =>
                  updateItemContent(item.id, (prev) => ({
                    ...prev,
                    items: prev.items.map((row) =>
                      row.id === entry.id ? { ...row, done: !row.done } : row
                    ),
                  }))
                }
              />
              <span className={entry.done ? 'line-through' : ''}>{entry.text}</span>
            </label>
          ))}
        </div>
      );
    }

    if (item.type === 'photos') {
      return (
        <div className="space-y-6 text-black">
          <div className="flex gap-3">
            <input
              value={photoUrl}
              onChange={(event) => setPhotoUrl(event.target.value)}
              placeholder="Paste image URL"
              className="flex-1 border-2 border-black px-3 py-2 outline-none"
            />
            <button
              onClick={() => {
                if (!photoUrl.trim()) return;

                updateItemContent(item.id, (prev) => ({
                  ...prev,
                  images: [...prev.images, { id: createId('photo'), url: photoUrl, favorite: false }],
                }));

                setPhotoUrl('');
              }}
              className="border-2 border-black bg-[#d9d9d9] px-4 py-2 shadow-[2px_2px_0_0_#000]"
            >
              Add Photo
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {item.content.images.map((image) => (
              <div
                key={image.id}
                className="border-4 border-black bg-white p-3 shadow-[4px_4px_0_0_#000]"
              >
                <img
                  src={image.url}
                  alt="memory"
                  className="h-56 w-full border-2 border-black object-cover"
                />
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() =>
                      updateItemContent(item.id, (prev) => ({
                        ...prev,
                        images: prev.images.map((row) =>
                          row.id === image.id ? { ...row, favorite: !row.favorite } : row
                        ),
                      }))
                    }
                    className="border-2 border-black bg-[#fff6b3] px-3 py-1 text-sm shadow-[2px_2px_0_0_#000]"
                  >
                    {image.favorite ? '★ Favorite' : '☆ Favorite'}
                  </button>
                  <button
                    onClick={() =>
                      updateItemContent(item.id, (prev) => ({
                        ...prev,
                        images: prev.images.filter((row) => row.id !== image.id),
                      }))
                    }
                    className="border-2 border-black bg-[#ffb3b3] px-3 py-1 text-sm shadow-[2px_2px_0_0_#000]"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (item.type === 'image') {
      return (
        <div className="space-y-4 text-black">
          {item.content.images?.[0] ? (
            <img
              src={item.content.images[0].url}
              alt={item.windowTitle}
              className="max-h-[420px] w-full border-2 border-black object-cover"
            />
          ) : (
            <p>No images yet.</p>
          )}
        </div>
      );
    }

    if (item.type === 'video-library') {
      const currentVideo =
        item.content.videos.find((video) => video.id === item.content.currentVideoId) ??
        item.content.videos[0];

      return (
        <div className="space-y-6 text-black">
          <div className="flex gap-3">
            <input
              value={videoUrl}
              onChange={(event) => setVideoUrl(event.target.value)}
              placeholder="Paste YouTube link"
              className="flex-1 border-2 border-black px-3 py-2 outline-none"
            />
            <button
              onClick={() => {
                const embedUrl = toEmbedUrl(videoUrl);
                if (!embedUrl) return;

                const newId = createId('video');

                updateItemContent(item.id, (prev) => ({
                  ...prev,
                  videos: [
                    ...prev.videos,
                    { id: newId, title: `Video ${prev.videos.length + 1}`, url: embedUrl },
                  ],
                  currentVideoId: newId,
                }));

                setVideoUrl('');
              }}
              className="border-2 border-black bg-[#d9d9d9] px-4 py-2 shadow-[2px_2px_0_0_#000]"
            >
              Add Video
            </button>
          </div>

          {currentVideo && (
            <div className="overflow-hidden border-4 border-black shadow-[6px_6px_0_0_#000]">
              <iframe
                className="aspect-video w-full"
                src={currentVideo.url}
                title={currentVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {item.content.videos.map((video) => (
              <div
                key={video.id}
                className="border-2 border-black bg-white p-3 shadow-[2px_2px_0_0_#000]"
              >
                <p className="font-bold">{video.title}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() =>
                      updateItemContent(item.id, (prev) => ({
                        ...prev,
                        currentVideoId: video.id,
                      }))
                    }
                    className="border-2 border-black bg-[#d9d9d9] px-3 py-1 text-sm"
                  >
                    Open
                  </button>
                  <button
                    onClick={() =>
                      updateItemContent(item.id, (prev) => {
                        const filtered = prev.videos.filter((row) => row.id !== video.id);

                        return {
                          ...prev,
                          videos: filtered,
                          currentVideoId: filtered[0]?.id ?? null,
                        };
                      })
                    }
                    className="border-2 border-black bg-[#ffb3b3] px-3 py-1 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (item.type === 'letters') {
      const featured =
        item.content.letters.find((letter) => letter.id === item.content.featuredLetterId) ??
        item.content.letters[0];

      return (
        <div className="space-y-6 text-black">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={letterTitle}
              onChange={(event) => setLetterTitle(event.target.value)}
              placeholder="Letter title"
              className="border-2 border-black px-3 py-2 outline-none"
            />
            <button
              onClick={() => {
                if (!item.content.letters.length) return;

                const random = item.content.letters[Math.floor(Math.random() * item.content.letters.length)];

                updateItemContent(item.id, (prev) => ({
                  ...prev,
                  featuredLetterId: random.id,
                }));
              }}
              className="border-2 border-black bg-[#fff6b3] px-4 py-2 shadow-[2px_2px_0_0_#000]"
            >
              Open Random Letter
            </button>
          </div>

          <textarea
            value={letterBody}
            onChange={(event) => setLetterBody(event.target.value)}
            placeholder="Write a sweet letter..."
            className="min-h-[140px] w-full border-2 border-black p-3 outline-none"
          />

          <button
            onClick={() => {
              if (!letterTitle.trim() || !letterBody.trim()) return;

              const newId = createId('letter');

              updateItemContent(item.id, (prev) => ({
                ...prev,
                letters: [
                  ...prev.letters,
                  {
                    id: newId,
                    title: letterTitle,
                    body: letterBody,
                    date: new Date().toLocaleDateString(),
                  },
                ],
                featuredLetterId: newId,
              }));

              setLetterTitle('');
              setLetterBody('');
            }}
            className="border-2 border-black bg-[#d9d9d9] px-4 py-2 shadow-[2px_2px_0_0_#000]"
          >
            Save Letter
          </button>

          {featured && (
            <div className="border-4 border-black bg-white p-4 shadow-[4px_4px_0_0_#000]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold">{featured.title}</h3>
                  <p className="mt-1 text-xs uppercase">{featured.date}</p>
                </div>

                <button
                  onClick={() =>
                    updateItemContent(item.id, (prev) => {
                      const updatedLetters = prev.letters.filter(
                        (letter) => letter.id !== featured.id
                      );

                      return {
                        ...prev,
                        letters: updatedLetters,
                        featuredLetterId: updatedLetters[0]?.id ?? null,
                      };
                    })
                  }
                  className="border-2 border-black bg-[#ffb3b3] px-3 py-1 text-sm shadow-[2px_2px_0_0_#000] hover:bg-[#ff8f8f]"
                >
                  Delete
                </button>
              </div>

    <p className="mt-4 whitespace-pre-wrap text-sm leading-7">{featured.body}</p>
  </div>
)}

        </div>
      );
    }

    if (item.type === 'countdown') {
      const isFinished = countdown === 'It is time ✨';

      return (
        <div className="space-y-6 text-[#1f1f1f]">
          {!isFinished && (
            <>
              <p className="text-sm leading-7">{item.content.message}</p>
              <div className="border-4 border-black bg-[#fff6b3] px-4 py-6 text-center shadow-[4px_4px_0_0_#000]">
                <p className="text-xs uppercase tracking-[0.2em]">Time remaining</p>
                <p className="mt-3 text-3xl font-bold md:text-4xl">{countdown}</p>
              </div>
            </>
          )}

          {isFinished && (
            <div className="border-4 border-black bg-[#f9c2e3] px-6 py-8 text-center shadow-[4px_4px_0_0_#000]">
              <p className="text-xs uppercase tracking-[0.2em]">Next Destination</p>
              <h3 className="mt-3 text-4xl font-bold">{item.content.reveal}</h3>
              <p className="mt-3 text-sm">Pack your bags… it’s time ✈️</p>
            </div>
          )}

          <div className="border-4 border-black bg-white p-4 shadow-[4px_4px_0_0_#000]">
            <h4 className="font-bold">Trip checklist</h4>
            <div className="mt-3 flex gap-3">
              <input
                value={destinationTodo}
                onChange={(event) => setDestinationTodo(event.target.value)}
                placeholder="Add checklist item"
                className="flex-1 border-2 border-black px-3 py-2 outline-none"
              />
              <button
                onClick={() => {
                  if (!destinationTodo.trim()) return;

                  updateItemContent(item.id, (prev) => ({
                    ...prev,
                    checklist: [
                      ...prev.checklist,
                      { id: createId('todo'), text: destinationTodo, done: false },
                    ],
                  }));

                  setDestinationTodo('');
                }}
                className="border-2 border-black bg-[#d9d9d9] px-4 py-2"
              >
                Add
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {item.content.checklist.map((todo) => (
                <label
                  key={todo.id}
                  className="flex items-center gap-3 border-2 border-black bg-[#f6f6f6] px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={todo.done}
                    onChange={() =>
                      updateItemContent(item.id, (prev) => ({
                        ...prev,
                        checklist: prev.checklist.map((row) =>
                          row.id === todo.id ? { ...row, done: !row.done } : row
                        ),
                      }))
                    }
                  />
                  <span className={todo.done ? 'line-through' : ''}>{todo.text}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (item.type === 'creator') {
      return (
        <div className="space-y-6 text-black">
          <div className="space-y-3">
            <p className="text-sm font-bold">Create a new desktop icon</p>

            <input
              value={creatorName}
              onChange={(e) => setCreatorName(e.target.value)}
              placeholder="Icon name"
              className="w-full border-2 border-black px-3 py-2 outline-none"
            />

            <select
              value={creatorType}
              onChange={(e) => setCreatorType(e.target.value)}
              className="w-full border-2 border-black px-3 py-2 outline-none"
            >
              {typeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <div>
              <p className="mb-2 text-sm">Choose an icon</p>

              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {iconOptions.map((iconOption) => (
                  <button
                    key={iconOption}
                    onClick={() => setCreatorIcon(iconOption)}
                    className={`border-2 border-black px-3 py-2 text-2xl shadow-[2px_2px_0_0_#000] ${
                      creatorIcon === iconOption ? 'bg-[#fff6b3]' : 'bg-white'
                    }`}
                  >
                    {iconOption}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-2 border-black bg-white px-3 py-3">
              <p className="text-xs uppercase">Selected icon</p>
              <p className="mt-2 text-3xl">{creatorIcon}</p>
            </div>

            <button
              onClick={addNewIcon}
              className="border-2 border-black bg-[#d9d9d9] px-4 py-2 shadow-[2px_2px_0_0_#000] hover:bg-white"
            >
              Create Icon
            </button>
          </div>

          <div className="border-t-4 border-black pt-4">
            <p className="mb-3 text-sm font-bold">Delete an icon</p>

            <select
              value={deleteTargetId}
              onChange={(e) => setDeleteTargetId(e.target.value)}
              className="w-full border-2 border-black bg-white px-3 py-2 outline-none"
            >
              <option value="">Select icon to delete</option>

              {deletableItems.map((deletableItem) => (
                <option key={deletableItem.id} value={deletableItem.id}>
                  {deletableItem.label}
                </option>
              ))}
            </select>

            <button
              onClick={requestDeleteIcon}
              disabled={!deleteTargetId}
              className="mt-3 border-2 border-black bg-[#ffb3b3] px-4 py-2 shadow-[2px_2px_0_0_#000] disabled:opacity-50"
            >
              Delete Icon
            </button>
          </div>
        </div>
      );
    }

    if (item.type === 'dreams') {
      return (
        <div className="space-y-6 text-black">
          <div className="grid gap-3 md:grid-cols-3">
            <input
              value={dreamName}
              onChange={(event) => setDreamName(event.target.value)}
              placeholder="Dream destination"
              className="border-2 border-black px-3 py-2 outline-none"
            />
            <select
              value={dreamPriority}
              onChange={(event) => setDreamPriority(event.target.value)}
              className="border-2 border-black px-3 py-2 outline-none"
            >
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
            <button
              onClick={() => {
                if (!dreamName.trim()) return;

                updateItemContent(item.id, (prev) => ({
                  ...prev,
                  dreams: [
                    ...prev.dreams,
                    {
                      id: createId('dream'),
                      text: dreamName,
                      priority: dreamPriority,
                      done: false,
                    },
                  ],
                }));

                setDreamName('');
                setDreamPriority('Medium');
              }}
              className="border-2 border-black bg-[#d9d9d9] px-4 py-2 shadow-[2px_2px_0_0_#000]"
            >
              Add Dream
            </button>
          </div>

          <div className="space-y-3">
            {item.content.dreams.map((dream) => (
              <div
                key={dream.id}
                className="flex flex-wrap items-center justify-between gap-3 border-4 border-black bg-white p-3 shadow-[4px_4px_0_0_#000]"
              >
                <div>
                  <p className={`font-bold ${dream.done ? 'line-through' : ''}`}>{dream.text}</p>
                  <p className="text-sm">Priority: {dream.priority}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      updateItemContent(item.id, (prev) => ({
                        ...prev,
                        dreams: prev.dreams.map((row) =>
                          row.id === dream.id ? { ...row, done: !row.done } : row
                        ),
                      }))
                    }
                    className="border-2 border-black bg-[#fff6b3] px-3 py-1 text-sm"
                  >
                    {dream.done ? 'Undo' : 'Done'}
                  </button>
                  <button
                    onClick={() =>
                      updateItemContent(item.id, (prev) => ({
                        ...prev,
                        dreams: prev.dreams.filter((row) => row.id !== dream.id),
                      }))
                    }
                    className="border-2 border-black bg-[#ffb3b3] px-3 py-1 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (item.type === 'map') {
      if (!isClient || !mapLib) {
        return (
          <div className="border-4 border-black bg-[#d9ecff] p-6 text-black shadow-[4px_4px_0_0_#000]">
            Loading map...
          </div>
        );
      }

      const {
        MapContainer,
        Marker,
        Popup,
        TileLayer,
        ZoomControl,
        greenIcon,
        yellowIcon,
        pinkIcon,
      } = mapLib;

      const { visited, dream, next } = item.content;

      return (
        <div className="space-y-6 text-black">
          <div className="border-4 border-black bg-[#d9ecff] p-4 shadow-[4px_4px_0_0_#000]">
            <h3 className="text-lg font-bold">🌍 Travel Map</h3>
            <p className="mt-2 text-sm">
              A real map of places visited, dream places, and your next destination.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <input
              value={mapPlaceName}
              onChange={(event) => setMapPlaceName(event.target.value)}
              placeholder="Place name"
              className="border-2 border-black px-3 py-2 outline-none"
            />
            <input
              value={mapLat}
              onChange={(event) => setMapLat(event.target.value)}
              placeholder="Latitude"
              className="border-2 border-black px-3 py-2 outline-none"
            />
            <input
              value={mapLng}
              onChange={(event) => setMapLng(event.target.value)}
              placeholder="Longitude"
              className="border-2 border-black px-3 py-2 outline-none"
            />
            <select
              value={mapCategory}
              onChange={(event) => setMapCategory(event.target.value)}
              className="border-2 border-black px-3 py-2 outline-none"
            >
              <option value="visited">Visited</option>
              <option value="dream">Dream</option>
              <option value="next">Next destination</option>
            </select>
          </div>

          <button
            onClick={() => {
              if (!mapPlaceName.trim() || mapLat === '' || mapLng === '') return;

              const latitude = Number(mapLat);
              const longitude = Number(mapLng);

              if (Number.isNaN(latitude) || Number.isNaN(longitude)) return;

              const newPlace = {
                id: createId('place'),
                name: mapPlaceName,
                position: [latitude, longitude],
              };

              updateItemContent(item.id, (prev) => {
                if (mapCategory === 'visited') {
                  return { ...prev, visited: [...prev.visited, newPlace] };
                }

                if (mapCategory === 'dream') {
                  return { ...prev, dream: [...prev.dream, newPlace] };
                }

                return { ...prev, next: newPlace };
              });

              setMapPlaceName('');
              setMapLat('');
              setMapLng('');
              setMapCategory('dream');
            }}
            className="border-2 border-black bg-[#d9d9d9] px-4 py-2 shadow-[2px_2px_0_0_#000]"
          >
            Add Place
          </button>

          <div className="overflow-hidden border-4 border-black shadow-[6px_6px_0_0_#000]">
            <MapContainer
              center={[32, 15]}
              zoom={2}
              scrollWheelZoom
              zoomControl={false}
              className="h-[420px] w-full"
            >
              <ZoomControl position="topright" />
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {visited.map((place) => (
                <Marker key={place.id} position={place.position} icon={greenIcon}>
                  <Popup>{place.name} · Visited</Popup>
                </Marker>
              ))}

              {dream.map((place) => (
                <Marker key={place.id} position={place.position} icon={yellowIcon}>
                  <Popup>{place.name} · Dream place</Popup>
                </Marker>
              ))}

              {next && (
                <Marker position={next.position} icon={pinkIcon}>
                  <Popup>{next.name} · Next destination</Popup>
                </Marker>
              )}
            </MapContainer>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="border-4 border-black bg-[#c7f9cc] p-4 shadow-[4px_4px_0_0_#000]">
              <h4 className="text-sm font-bold uppercase">Visited places</h4>
              <ul className="mt-3 space-y-2 text-sm">
                {visited.map((place) => (
                  <li
                    key={place.id}
                    className="border-2 border-black bg-white px-3 py-2 shadow-[2px_2px_0_0_#000]"
                  >
                    {place.name}
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-4 border-black bg-[#fff6b3] p-4 shadow-[4px_4px_0_0_#000]">
              <h4 className="text-sm font-bold uppercase">Dream places</h4>
              <ul className="mt-3 space-y-2 text-sm">
                {dream.map((place) => (
                  <li
                    key={place.id}
                    className="border-2 border-black bg-white px-3 py-2 shadow-[2px_2px_0_0_#000]"
                  >
                    {place.name}
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-4 border-black bg-[#f9c2e3] p-4 shadow-[4px_4px_0_0_#000]">
              <h4 className="text-sm font-bold uppercase">Next destination</h4>
              {next && (
                <div className="mt-3 border-2 border-black bg-white px-3 py-4 text-center shadow-[2px_2px_0_0_#000]">
                  <p className="text-3xl">🏝️</p>
                  <p className="mt-2 text-sm font-bold">{next.name}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (item.type === 'random-dates') {
      const ideas = item.content.ideas ?? [];
      const history = item.content.history ?? [];
      const lastResult = item.content.lastResult;

      const usedIdeas = new Set(history.map((entry) => entry.idea));
      const availableIdeas = ideas.filter((idea) => !usedIdeas.has(idea));

      const spinRoulette = () => {
        if (rouletteState.spinning) return;
        if (availableIdeas.length === 0) return;

        const randomIndex = Math.floor(Math.random() * availableIdeas.length);
        const selectedIdea = availableIdeas[randomIndex];

        const newRotation =
          rouletteState.rotation + 360 * 6 + Math.floor(Math.random() * 360);

        setRouletteState({
          spinning: true,
          rotation: newRotation,
        });

        setTimeout(() => {
          const selectedAt = new Date();
          const deadline = addOneMonth(selectedAt);

          const newResult = {
            id: Date.now().toString(),
            idea: selectedIdea,
            selectedAt: selectedAt.toISOString(),
            deadline: deadline.toISOString(),
            completed: false,
          };

          updateItemContent(item.id, (prev) => ({
            ...prev,
            lastResult: newResult,
            history: [...(prev.history ?? []), newResult],
          }));

          setRouletteState((prev) => ({
            ...prev,
            spinning: false,
          }));
        }, 2800);
      };

      return (
        <div className="space-y-6 text-black">
          <div className="border-4 border-black bg-[#f9c2e3] p-4 shadow-[4px_4px_0_0_#000]">
            <h3 className="text-lg font-bold">🎲 Random Date Roulette</h3>
            <p className="mt-2 text-sm">
              Spin the roulette. Whatever date comes out, you have one month to make it happen.
              Once a date is selected, it is removed from the roulette.
            </p>
          </div>

          <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
            <div className="relative flex h-72 w-72 items-center justify-center">
              <div className="absolute -top-2 z-20 text-4xl">▼</div>

              <div
                className="flex h-64 w-64 items-center justify-center rounded-full border-4 border-black shadow-[6px_6px_0_0_#000] transition-transform duration-[2800ms] ease-out"
                style={{
                  transform: `rotate(${rouletteState.rotation}deg)`,
                  background:
                    'conic-gradient(#f9a8d4 0deg 30deg, #fde68a 30deg 60deg, #86efac 60deg 90deg, #bfdbfe 90deg 120deg, #fca5a5 120deg 150deg, #ddd6fe 150deg 180deg, #f9a8d4 180deg 210deg, #fde68a 210deg 240deg, #86efac 240deg 270deg, #bfdbfe 270deg 300deg, #fca5a5 300deg 330deg, #ddd6fe 330deg 360deg)',
                }}
              >
                <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-black bg-white text-center text-sm font-bold shadow-[3px_3px_0_0_#000]">
                  DATE
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <button
                onClick={spinRoulette}
                disabled={rouletteState.spinning || availableIdeas.length === 0}
                className="w-full border-4 border-black bg-[#fff6b3] px-6 py-4 text-lg font-bold shadow-[4px_4px_0_0_#000] hover:bg-white disabled:opacity-60"
              >
                {rouletteState.spinning
                  ? 'Spinning...'
                  : availableIdeas.length === 0
                    ? 'All dates completed'
                    : 'Spin Roulette'}
              </button>

              <div className="border-4 border-black bg-white p-4 text-sm shadow-[4px_4px_0_0_#000]">
                <p className="font-bold">Dates remaining:</p>
                <p className="mt-1 text-2xl font-bold">{availableIdeas.length}</p>
              </div>

              {lastResult && (
                <div className="border-4 border-black bg-white p-4 shadow-[4px_4px_0_0_#000]">
                  <p className="text-xs uppercase tracking-[0.2em]">Your latest date is</p>

                  <h4 className="mt-3 text-2xl font-bold">{lastResult.idea}</h4>

                  <div className="mt-4 border-2 border-black bg-[#c7f9cc] p-3 text-sm shadow-[2px_2px_0_0_#000]">
                    <p className="font-bold">Deadline:</p>
                    <p>{formatDeadline(lastResult.deadline)}</p>
                  </div>

                  <p className="mt-3 text-sm">
                    You have one month to make this date happen. No excuses 💗
                  </p>
                </div>
              )}

              {!lastResult && (
                <div className="border-4 border-black bg-white p-4 text-sm shadow-[4px_4px_0_0_#000]">
                  No date has been selected yet. Spin the roulette to reveal one.
                </div>
              )}
            </div>
          </div>

          {history.length > 0 && (
            <div className="border-4 border-black bg-white p-4 shadow-[4px_4px_0_0_#000]">
              <h4 className="font-bold">Selected Dates</h4>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-[#d9d9d9]">
                      <th className="border-2 border-black px-3 py-2 text-left">Date idea</th>
                      <th className="border-2 border-black px-3 py-2 text-left">Selected on</th>
                      <th className="border-2 border-black px-3 py-2 text-left">Deadline</th>
                      <th className="border-2 border-black px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {history.map((entry) => (
                      <tr key={entry.id}>
                        <td className="border-2 border-black px-3 py-2">
                          {entry.idea}
                        </td>

                        <td className="border-2 border-black px-3 py-2">
                          {formatDeadline(entry.selectedAt)}
                        </td>

                        <td className="border-2 border-black px-3 py-2">
                          {formatDeadline(entry.deadline)}
                        </td>

                        <td className="border-2 border-black px-3 py-2">
                          <button
                            onClick={() =>
                              updateItemContent(item.id, (prev) => ({
                                ...prev,
                                history: (prev.history ?? []).map((row) =>
                                  row.id === entry.id
                                    ? { ...row, completed: !row.completed }
                                    : row
                                ),
                              }))
                            }
                            className={`border-2 border-black px-3 py-1 text-xs shadow-[2px_2px_0_0_#000] ${
                              entry.completed ? 'bg-[#c7f9cc]' : 'bg-[#fff6b3]'
                            }`}
                          >
                            {entry.completed ? 'Completed' : 'Pending'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {availableIdeas.length === 0 && (
            <div className="border-4 border-black bg-[#c7f9cc] p-4 text-center shadow-[4px_4px_0_0_#000]">
              <h4 className="text-xl font-bold">You completed all the dates 💗</h4>
              <p className="mt-2 text-sm">
                Time to create a new list of date ideas.
              </p>
            </div>
          )}
        </div>
      );
    }

    if (item.type === 'music') {
      const currentTrack =
        item.content.tracks.find((track) => track.id === item.content.currentTrackId) ??
        item.content.tracks[0];

      return (
        <div className="space-y-6 text-black">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={trackTitle}
              onChange={(event) => setTrackTitle(event.target.value)}
              placeholder="Track title"
              className="border-2 border-black px-3 py-2 outline-none"
            />
            <input
              value={trackUrl}
              onChange={(event) => setTrackUrl(event.target.value)}
              placeholder="Audio URL (.mp3)"
              className="border-2 border-black px-3 py-2 outline-none"
            />
          </div>

          <button
            onClick={() => {
              if (!trackTitle.trim() || !trackUrl.trim()) return;

              const newId = createId('track');

              updateItemContent(item.id, (prev) => ({
                ...prev,
                tracks: [...prev.tracks, { id: newId, title: trackTitle, url: trackUrl }],
                currentTrackId: newId,
              }));

              setTrackTitle('');
              setTrackUrl('');
            }}
            className="border-2 border-black bg-[#d9d9d9] px-4 py-2 shadow-[2px_2px_0_0_#000]"
          >
            Add Track
          </button>

          {currentTrack && (
            <div className="border-4 border-black bg-white p-4 shadow-[4px_4px_0_0_#000]">
              <h3 className="font-bold">{currentTrack.title}</h3>
              <audio className="mt-4 w-full" controls src={currentTrack.url} />
            </div>
          )}

          <div className="space-y-3">
            {item.content.tracks.map((track) => (
              <div
                key={track.id}
                className="flex items-center justify-between gap-3 border-2 border-black bg-white p-3 shadow-[2px_2px_0_0_#000]"
              >
                <span>{track.title}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      updateItemContent(item.id, (prev) => ({
                        ...prev,
                        currentTrackId: track.id,
                      }))
                    }
                    className="border-2 border-black bg-[#d9d9d9] px-3 py-1 text-sm"
                  >
                    Play
                  </button>
                  <button
                    onClick={() =>
                      updateItemContent(item.id, (prev) => {
                        const filtered = prev.tracks.filter((row) => row.id !== track.id);

                        return {
                          ...prev,
                          tracks: filtered,
                          currentTrackId: filtered[0]?.id ?? null,
                        };
                      })
                    }
                    className="border-2 border-black bg-[#ffb3b3] px-3 py-1 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (item.type === 'calendar') {
      return (
        <div className="space-y-6 text-black">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={eventTitle}
              onChange={(event) => setEventTitle(event.target.value)}
              placeholder="Event title"
              className="border-2 border-black px-3 py-2 outline-none"
            />
            <input
              value={eventDate}
              onChange={(event) => setEventDate(event.target.value)}
              type="date"
              className="border-2 border-black px-3 py-2 outline-none"
            />
          </div>

          <button
            onClick={() => {
              if (!eventTitle.trim() || !eventDate) return;

              updateItemContent(item.id, (prev) => ({
                ...prev,
                events: [
                  ...prev.events,
                  { id: createId('event'), title: eventTitle, date: eventDate },
                ],
              }));

              setEventTitle('');
              setEventDate('');
            }}
            className="border-2 border-black bg-[#d9d9d9] px-4 py-2 shadow-[2px_2px_0_0_#000]"
          >
            Add Event
          </button>

          <div className="space-y-3">
            {[...item.content.events]
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between gap-3 border-4 border-black bg-white p-3 shadow-[4px_4px_0_0_#000]"
                >
                  <div>
                    <p className="font-bold">{event.title}</p>
                    <p className="text-sm">{event.date}</p>
                  </div>
                  <button
                    onClick={() =>
                      updateItemContent(item.id, (prev) => ({
                        ...prev,
                        events: prev.events.filter((row) => row.id !== event.id),
                      }))
                    }
                    className="border-2 border-black bg-[#ffb3b3] px-3 py-1 text-sm"
                  >
                    Delete
                  </button>
                </div>
              ))}
          </div>
        </div>
      );
    }

    if (item.type === 'guestbook') {
      return (
        <div className="space-y-6 text-black">
          <textarea
            value={guestbookText}
            onChange={(event) => setGuestbookText(event.target.value)}
            placeholder="Write a quick memory or thought..."
            className="min-h-[140px] w-full border-2 border-black p-3 outline-none"
          />

          <button
            onClick={() => {
              if (!guestbookText.trim()) return;

              updateItemContent(item.id, (prev) => ({
                ...prev,
                entries: [
                  {
                    id: createId('entry'),
                    text: guestbookText,
                    date: new Date().toLocaleString(),
                  },
                  ...prev.entries,
                ],
              }));

              setGuestbookText('');
            }}
            className="border-2 border-black bg-[#d9d9d9] px-4 py-2 shadow-[2px_2px_0_0_#000]"
          >
            Save Entry
          </button>

          <div className="space-y-3">
            {item.content.entries.map((entry) => (
              <div
                key={entry.id}
                className="border-4 border-black bg-white p-4 shadow-[4px_4px_0_0_#000]"
              >
                <p className="text-xs uppercase">{entry.date}</p>
                <p className="mt-3 whitespace-pre-wrap text-sm">{entry.text}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (item.type === 'secrets') {
      if (!item.content.unlocked) {
        return (
          <div className="space-y-4 text-black">
            <p className="text-sm font-bold">Protected content</p>
            <input
              value={secretPasswordInput}
              onChange={(event) => setSecretPasswordInput(event.target.value)}
              type="password"
              placeholder="Password"
              className="w-full border-2 border-black px-3 py-2 outline-none"
            />
            <button
              onClick={() => {
                if (secretPasswordInput === item.content.password) {
                  updateItemContent(item.id, (prev) => ({ ...prev, unlocked: true }));
                  setSecretPasswordInput('');
                }
              }}
              className="border-2 border-black bg-[#d9d9d9] px-4 py-2 shadow-[2px_2px_0_0_#000]"
            >
              Unlock
            </button>
          </div>
        );
      }

      return (
        <div className="space-y-6 text-black">
          <textarea
            value={secretNote}
            onChange={(event) => setSecretNote(event.target.value)}
            placeholder="Write a secret note..."
            className="min-h-[120px] w-full border-2 border-black p-3 outline-none"
          />

          <div className="flex gap-3">
            <button
              onClick={() => {
                if (!secretNote.trim()) return;

                updateItemContent(item.id, (prev) => ({
                  ...prev,
                  notes: [...prev.notes, secretNote],
                }));

                setSecretNote('');
              }}
              className="border-2 border-black bg-[#d9d9d9] px-4 py-2 shadow-[2px_2px_0_0_#000]"
            >
              Save Secret
            </button>

            <button
              onClick={() =>
                updateItemContent(item.id, (prev) => ({
                  ...prev,
                  unlocked: false,
                }))
              }
              className="border-2 border-black bg-[#fff6b3] px-4 py-2 shadow-[2px_2px_0_0_#000]"
            >
              Lock Again
            </button>
          </div>

          <div className="space-y-3">
            {item.content.notes.map((note, index) => (
              <div
                key={`${item.id}-${index}`}
                className="border-4 border-black bg-white p-4 shadow-[4px_4px_0_0_#000]"
              >
                {note}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-[#0f4c5c] p-4 font-mono md:p-8">
      <div
        className="relative mx-auto h-[80vh] max-w-[1200px] overflow-hidden border-4 border-black bg-[#1a6a73] shadow-[8px_8px_0_0_#000]"
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDesktopDrop}
      >
        <div className="flex items-center justify-between border-b-4 border-black bg-[#c0c0c0] px-3 py-2 text-sm text-black">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 border border-black bg-[#ff5f57]" />
            <span className="inline-block h-3 w-3 border border-black bg-[#ffbd2e]" />
            <span className="inline-block h-3 w-3 border border-black bg-[#28c840]" />
            <span className="ml-2 font-bold">My Retro Desktop</span>
          </div>
          <span>{draggingId ? 'Dragging icon...' : 'Travel Memories OS'}</span>
        </div>

        <div className="absolute inset-0 top-[44px] bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:32px_32px]" />

        <div className="absolute left-3 top-3 z-20 flex gap-2">
          {['home', 'about', 'photos', 'letters'].map((menuItem) => (
            <button
              key={menuItem}
              className="border-2 border-black bg-[#d9d9d9] px-3 py-1 text-xs uppercase text-black shadow-[2px_2px_0_0_#000] hover:bg-white"
            >
              {menuItem}
            </button>
          ))}
        </div>

        {desktopItems.map((item) => (
          <button
            key={item.id}
            draggable
            onDragStart={(event) => startDrag(event, item.id)}
            onDragEnd={() => setDraggingId(null)}
            onDoubleClick={() => setActiveItemId(item.id)}
            className="absolute z-20 flex w-24 flex-col items-center text-center text-white outline-none"
            style={{ left: item.x, top: item.y }}
            title="Drag to move · Double click to open"
          >
            <div className="flex h-14 w-14 items-center justify-center border-2 border-black bg-[#d9d9d9] text-3xl shadow-[3px_3px_0_0_#000] transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000]">
              {item.icon}
            </div>
            <span className="mt-2 bg-black/40 px-1 text-xs leading-tight text-white">{item.label}</span>
          </button>
        ))}

        <div className="absolute bottom-0 left-0 right-0 z-30 flex items-center justify-between border-t-4 border-black bg-[#c0c0c0] px-2 py-2 text-xs text-black">
          <div className="flex items-center gap-2">
            <button className="border-2 border-black bg-[#d9d9d9] px-3 py-1 font-bold shadow-[2px_2px_0_0_#000]">
              Start
            </button>
            <span className="border-2 border-black bg-white px-2 py-1">Retro memories ready</span>
          </div>
          <span className="border-2 border-black bg-white px-2 py-1">Double click icons</span>
        </div>

        {activeItem && (
          <DraggableWindow
            item={activeItem}
            onClose={() => setActiveItemId(null)}
            onUpdatePosition={updateItem}
          >
            {renderWindowContent(activeItem)}
          </DraggableWindow>
        )}

        {showDeleteConfirm && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md border-4 border-black bg-[#efefef] shadow-[8px_8px_0_0_#000]">
              <div className="border-b-4 border-black bg-[#800000] px-4 py-2 text-sm font-bold text-white">
                Confirm Deletion
              </div>

              <div className="space-y-4 p-5 text-black">
                <p className="text-sm">
                  Are you sure you want to delete this icon? This action cannot be undone.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={confirmDeleteIcon}
                    className="border-2 border-black bg-[#ffb3b3] px-4 py-2 shadow-[2px_2px_0_0_#000]"
                  >
                    Yes, delete
                  </button>

                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="border-2 border-black bg-[#d9d9d9] px-4 py-2 shadow-[2px_2px_0_0_#000]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
