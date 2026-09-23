import { Camera, Check, ImageOff, Minus, Move, Plus, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { PHOTO_MAX_BYTES, PHOTO_TYPES } from '../../../shared/constants';
import { uploadPhoto, type CropBox } from '../net/photos';
import type { ProfilePhoto } from '../net/session';
import { FormError, Spinner } from './Chrome';
import { Sheet } from './Sheet';

const FRAME = 260;
const MAX_ZOOM = 4;

interface Source {
  url: string;
  file: File;
  width: number;
  height: number;
}

/** Choix, recadrage carré et envoi d'une photo de profil. `value` null : avatar dessiné. */
export function PhotoPicker({ value, onChange }: { value: ProfilePhoto | null; onChange: (photo: ProfilePhoto | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hintId = useId();

  useEffect(() => () => {
    if (source) URL.revokeObjectURL(source.url);
  }, [source]);

  const pick = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) {
      setError('Format non pris en charge : choisis une image JPEG, PNG ou WebP.');
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setError(`Photo trop lourde (${(file.size / 1024 / 1024).toFixed(1).replace('.', ',')} Mo) : 5 Mo maximum.`);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setSource({ url, file, width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError('Image illisible : essaie une autre photo.');
    };
    img.src = url;
  };

  return (
    <div className="photo-picker">
      <div className="photo-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => inputRef.current?.click()} aria-describedby={hintId}>
          <Camera size={17} /> {value ? 'Changer de photo' : 'Importer une photo'}
        </button>
        {value && (
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => onChange(null)}>
            <ImageOff size={17} /> Revenir à un avatar dessiné
          </button>
        )}
      </div>
      <p className="form-hint" id={hintId}>
        JPEG, PNG ou WebP · 5 Mo maximum · recadrée en carré. Visible seulement par les joueurs de tes salons.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <FormError message={error} />
      {source && (
        <CropSheet
          source={source}
          onCancel={() => setSource(null)}
          onDone={(photo) => {
            setSource(null);
            onChange(photo);
          }}
        />
      )}
    </div>
  );
}

function CropSheet({ source, onCancel, onDone }: { source: Source; onCancel: () => void; onDone: (photo: ProfilePhoto) => void }) {
  const min = Math.min(source.width, source.height);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState({ x: source.width / 2, y: source.height / 2 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);

  const side = min / zoom;
  const scale = FRAME / side;
  const clamp = (c: { x: number; y: number }, s = side) => ({
    x: Math.min(Math.max(c.x, s / 2), source.width - s / 2),
    y: Math.min(Math.max(c.y, s / 2), source.height - s / 2),
  });
  const setZoomSafe = (z: number) => {
    const next = Math.min(MAX_ZOOM, Math.max(1, z));
    setZoom(next);
    setCenter((c) => clamp(c, min / next));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, cx: center.x, cy: center.y };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    setCenter(clamp({ x: d.cx - (e.clientX - d.x) / scale, y: d.cy - (e.clientY - d.y) / scale }));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = side * 0.05;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      setCenter((c) => clamp({ x: c.x + moves[e.key][0], y: c.y + moves[e.key][1] }));
    } else if (e.key === '+' || e.key === '=') setZoomSafe(zoom + 0.25);
    else if (e.key === '-') setZoomSafe(zoom - 0.25);
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const crop: CropBox = { x: (center.x - side / 2) / source.width, y: (center.y - side / 2) / source.height, size: side / min };
    const res = await uploadPhoto(source.file, crop);
    setBusy(false);
    if (res.ok) onDone(res.photo);
    else setError(res.message);
  };

  return (
    <Sheet open onClose={onCancel} title="Recadrer ta photo" icon={<Move size={20} />}>
      <div className="stack">
        <p className="muted">Fais glisser la photo et zoome : seul le cercle apparaîtra à côté de ton pseudo.</p>
        <div
          className="crop-frame"
          style={{ width: FRAME, height: FRAME }}
          tabIndex={0}
          role="application"
          aria-label="Zone de recadrage : flèches pour déplacer, plus et moins pour zoomer"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onKeyDown={onKeyDown}
        >
          <img
            src={source.url}
            alt=""
            draggable={false}
            style={{
              width: source.width * scale,
              height: source.height * scale,
              transform: `translate(${FRAME / 2 - center.x * scale}px, ${FRAME / 2 - center.y * scale}px)`,
            }}
          />
          <span className="crop-mask" aria-hidden="true" />
        </div>
        <div className="crop-zoom">
          <button type="button" className="icon-btn" onClick={() => setZoomSafe(zoom - 0.25)} aria-label="Dézoomer" disabled={zoom <= 1}>
            <Minus size={18} />
          </button>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoomSafe(Number(e.target.value))}
            aria-label="Zoom"
          />
          <button type="button" className="icon-btn" onClick={() => setZoomSafe(zoom + 0.25)} aria-label="Zoomer" disabled={zoom >= MAX_ZOOM}>
            <Plus size={18} />
          </button>
        </div>
        <FormError message={error} />
        <div className="stack-sm">
          <button type="button" className="btn btn-primary btn-block" onClick={confirm} disabled={busy}>
            {busy ? <Spinner /> : <Check size={19} strokeWidth={3} />} {busy ? 'Envoi…' : 'Utiliser cette photo'}
          </button>
          <button type="button" className="btn btn-quiet btn-block" onClick={onCancel} disabled={busy}>
            <Trash2 size={17} /> Annuler
          </button>
        </div>
      </div>
    </Sheet>
  );
}
