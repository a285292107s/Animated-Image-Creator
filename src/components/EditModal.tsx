import React, { useRef, useState, useCallback, useEffect, useLayoutEffect } from 'react';
import { X, ZoomIn, Minus, Plus, RefreshCw, RotateCcw } from 'lucide-react';
import type { EditModalProps } from '../types/frame';
import { ZOOM_MIN, ZOOM_MAX, ZOOM_WHEEL_SENSITIVITY, EDIT_MODAL_PADDING } from '../constants';
import '../App.css';

const EditModal: React.FC<EditModalProps> = React.memo(({ frame, baseWidth, baseHeight, onSave, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: frame.offsetX, y: frame.offsetY });
  const [scale, setScale] = useState(frame.scale || 1);
  const [rotation, setRotation] = useState(frame.rotation || 0);
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [imageBitmap, setImageBitmap] = useState<ImageBitmap | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [viewScale, setViewScale] = useState(1);

  useEffect(() => {
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale(prev => {
        const delta = -e.deltaY * ZOOM_WHEEL_SENSITIVITY * prev;
        return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, prev + delta));
      });
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    createImageBitmap(frame.file).then(setImageBitmap);
  }, [frame.file]);

  useLayoutEffect(() => {
    if (!wrapperRef.current) return;
    const updateSize = () => {
      if (!wrapperRef.current) return;
      const { clientWidth, clientHeight } = wrapperRef.current;
      setCanvasSize({ width: clientWidth, height: clientHeight });
      const padding = EDIT_MODAL_PADDING;
      const fitScale = Math.min((clientWidth - padding) / baseWidth, (clientHeight - padding) / baseHeight);
      setViewScale(fitScale > 0 ? fitScale : 1);
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [baseWidth, baseHeight]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageBitmap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== canvasSize.width * dpr || canvas.height !== canvasSize.height * dpr) {
      canvas.width = canvasSize.width * dpr;
      canvas.height = canvasSize.height * dpr;
      ctx.scale(dpr, dpr);
    }
    canvas.style.width = `${canvasSize.width}px`;
    canvas.style.height = `${canvasSize.height}px`;

    const cw = canvasSize.width;
    const ch = canvasSize.height;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const baseRectW = baseWidth * viewScale;
    const baseRectH = baseHeight * viewScale;
    const baseRectX = (cw - baseRectW) / 2;
    const baseRectY = (ch - baseRectH) / 2;

    ctx.clearRect(0, 0, cw, ch);

    const gridSize = 15;
    for (let y = 0; y < ch; y += gridSize) {
      for (let x = 0; x < cw; x += gridSize) {
        ctx.fillStyle = (Math.floor(x / gridSize) + Math.floor(y / gridSize)) % 2 === 0 ? '#1a1a1a' : '#222';
        ctx.fillRect(x, y, gridSize, gridSize);
      }
    }

    ctx.save();
    const cx = (cw / 2) + (offset.x * viewScale);
    const cy = (ch / 2) + (offset.y * viewScale);
    ctx.translate(cx, cy);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale * viewScale, scale * viewScale);
    ctx.drawImage(imageBitmap, -imageBitmap.width / 2, -imageBitmap.height / 2);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cw, ch);
    ctx.rect(baseRectX, baseRectY, baseRectW, baseRectH);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fill('evenodd');
    ctx.restore();

    ctx.strokeStyle = '#4c6ef5';
    ctx.lineWidth = 2;
    ctx.strokeRect(baseRectX, baseRectY, baseRectW, baseRectH);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(cw / 2, baseRectY); ctx.lineTo(cw / 2, baseRectY + baseRectH);
    ctx.moveTo(baseRectX, ch / 2); ctx.lineTo(baseRectX + baseRectW, ch / 2);
    ctx.stroke();

  }, [imageBitmap, offset, scale, rotation, viewScale, baseWidth, baseHeight, canvasSize]);

  useEffect(() => { draw(); }, [draw]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPos.x;
    const dy = e.clientY - lastPos.y;
    setOffset(prev => ({ x: prev.x + dx / viewScale, y: prev.y + dy / viewScale }));
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleReset = () => { setOffset({ x: 0, y: 0 }); setScale(1); setRotation(0); };

  const adjustScale = (amount: number) => setScale(prev => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, parseFloat((prev + amount).toFixed(2)))));
  const adjustRotation = (amount: number) => setRotation(prev => prev + amount);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Adjust Frame Position</h3>
          <button className="close-modal-btn" onClick={onClose} aria-label="Close editor"><X size={24} /></button>
        </div>

        <div className="canvas-wrapper" ref={wrapperRef}>
          <canvas
            ref={canvasRef}
            className="canvas-container"
            aria-label="Frame position editor"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>

        <div className="modal-footer">
          <div className="control-row">
            <div className="slider-group">
              <ZoomIn size={18} />
              <label>Zoom</label>
              <button className="btn-icon-small" onClick={() => adjustScale(-0.01)}><Minus size={14} /></button>
              <input
                type="range"
                min="0.01" max="5" step="0.01"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                style={{flex: 1}}
              />
              <button className="btn-icon-small" onClick={() => adjustScale(0.01)}><Plus size={14} /></button>
              <span className="value-badge">{(scale * 100).toFixed(0)}%</span>
            </div>

            <div className="slider-group">
              <RefreshCw size={18} />
              <label>Rotate</label>
              <button className="btn-icon-small" onClick={() => adjustRotation(-90)} title="-90°"><RotateCcw size={14} /></button>
              <input
                type="range"
                min="-180" max="180" step="1"
                value={rotation}
                onChange={(e) => setRotation(parseInt(e.target.value))}
                style={{flex: 1}}
              />
              <button className="btn-icon-small" onClick={() => adjustRotation(90)} title="+90°"><RefreshCw size={14} /></button>
              <span className="value-badge">{rotation}°</span>
            </div>
          </div>

          <div className="button-group" style={{marginTop: '1rem'}}>
            <button className="btn btn-secondary" onClick={handleReset}>Reset All</button>
            <div style={{flex: 1}}></div>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={() => onSave(frame.id, offset.x, offset.y, scale, rotation)}>Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default EditModal;
