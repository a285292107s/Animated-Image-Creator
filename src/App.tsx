import React, { useState, useRef, useCallback, useEffect } from 'react';
import EditModal from './components/EditModal';
import { useTheme } from './hooks/useTheme';
import UPNG from 'upng-js';
import {
  Upload, Trash2, Clock, Download, Sun, Moon,
  X, Play, Wand2, FileVideo, FilePenLine, Github, Move
} from 'lucide-react';
import './App.css';
import { assembleWebP } from './utils/webp-assembler';
import { formatSize } from './utils/format';
import { isAnimatedPNG } from './utils/apng-detector';
import { parseAPNG } from './utils/apng-parser';
import { createFrameRenderContext, renderFrameToCanvas } from './utils/render-frames';
import type { Frame } from './types/frame';
import { DEFAULT_GLOBAL_DELAY, DEFAULT_APNG_COMPRESSION, DEFAULT_WEBP_QUALITY, FRAME_ANIMATION_DELAY_STEP } from './constants';

function normalizeBaseFrame(frames: Frame[]): Frame[] {
  if (frames.length === 0) return frames;
  const result = [...frames];
  result[0] = { ...result[0], scale: 1, offsetX: 0, offsetY: 0, rotation: 0 };
  return result;
}

function App() {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [globalDelay, setGlobalDelay] = useState(DEFAULT_GLOBAL_DELAY);
  const [generatedApng, setGeneratedApng] = useState<string | null>(null);
  const [generatedWebP, setGeneratedWebP] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingFrame, setEditingFrame] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draggedFrameId, setDraggedFrameId] = useState<string | null>(null);
  const { theme, toggleTheme } = useTheme();

  const [exportFileName, setExportFileName] = useState("animation");
  const [resultSize, setResultSize] = useState<string | null>(null);
  const [apngCompression, setApngCompression] = useState(DEFAULT_APNG_COMPRESSION);
  const [webpQuality, setWebpQuality] = useState(DEFAULT_WEBP_QUALITY);

  useEffect(() => {
    const currentFrames = frames;
    return () => {
      currentFrames.forEach(f => URL.revokeObjectURL(f.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList) return;
    const newFramesData: Frame[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];

      try {
        const isAPNG = file.name.toLowerCase().endsWith('.apng') ||
                      (file.type === 'image/png' && await isAnimatedPNG(file));

        if (isAPNG) {
          const apngFrames = await parseAPNG(file);
          newFramesData.push(...apngFrames);
          continue;
        }

        if (!file.type.startsWith('image/')) continue;
        const bmp = await createImageBitmap(file);
        newFramesData.push({
          id: Math.random().toString(36).slice(2, 11),
          file,
          previewUrl: URL.createObjectURL(file),
          delay: globalDelay,
          width: bmp.width,
          height: bmp.height,
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          rotation: 0,
          fileSize: file.size,
          fileType: file.type.split('/')[1].toUpperCase().replace('JPEG', 'JPG')
        });
      } catch (err) {
        console.error(`Error processing file ${file.name}:`, err);
        alert(`Error processing ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    setFrames(prev => {
      const combined = [...prev, ...newFramesData];
      return normalizeBaseFrame(combined);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [globalDelay]);

  const handleSmartAlign = () => {
    if (frames.length < 2) return;
    const baseW = frames[0].width;
    const baseH = frames[0].height;

    setFrames(prev => prev.map((frame, index) => {
      if (index === 0) return frame;

      const scaleX = baseW / frame.width;
      const scaleY = baseH / frame.height;
      const newScale = Math.max(scaleX, scaleY);

      return { ...frame, scale: parseFloat(newScale.toFixed(4)) };
    }));
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingFile(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingFile(false); };
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingFile(false); handleFiles(e.dataTransfer.files); };
  const handleClearAll = () => {
    setFrames([]);
    setGeneratedApng(null);
    setGeneratedWebP(null);
    setResultSize(null);
    setExportFileName("animation");
  };

  const removeFrame = (id: string) => {
    setFrames(prev => {
      const frame = prev.find(f => f.id === id);
      if (frame) URL.revokeObjectURL(frame.previewUrl);
      const newFrames = prev.filter(f => f.id !== id);

      if (newFrames.length === 0) {
        setGeneratedApng(null);
        setGeneratedWebP(null);
        setResultSize(null);
        setExportFileName("animation");
      }

      return normalizeBaseFrame(newFrames);
    });
  };

  const updateFrameDelay = (id: string, delay: number) => {
    setFrames(prev => prev.map(f => f.id === id ? { ...f, delay: Math.max(0, delay) } : f));
  };

  const handleSortStart = (id: string) => setDraggedFrameId(id);
  const handleSortOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedFrameId || draggedFrameId === targetId) return;
    const draggedIndex = frames.findIndex(f => f.id === draggedFrameId);
    const targetIndex = frames.findIndex(f => f.id === targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;
    const newFrames = [...frames];
    const [removed] = newFrames.splice(draggedIndex, 1);
    newFrames.splice(targetIndex, 0, removed);

    setFrames(normalizeBaseFrame(newFrames));
  };
  const handleSortEnd = () => setDraggedFrameId(null);

  const saveFrameOffset = (id: string, x: number, y: number, scale: number, rotation: number) => {
    setFrames(prev => prev.map(f => f.id === id ? { ...f, offsetX: x, offsetY: y, scale, rotation } : f));
    setEditingFrame(null);
  };

  const generateAPNG = async () => {
    if (frames.length === 0) return;
    setIsGenerating(true);
    setGeneratedWebP(null);
    setResultSize(null);
    try {
      const { ctx, imageBitmaps, width, height } = await createFrameRenderContext(frames);
      const buffers: ArrayBuffer[] = [];
      const delays = frames.map(f => f.delay);

      for (let i = 0; i < frames.length; i++) {
        renderFrameToCanvas(ctx, imageBitmaps[i], frames[i], width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        buffers.push(imageData.data.buffer);
      }
      const apngBuffer = UPNG.encode(buffers, width, height, apngCompression, delays);
      const blob = new Blob([apngBuffer], { type: 'image/png' });
      setResultSize(formatSize(blob.size));
      const url = URL.createObjectURL(blob);
      setGeneratedApng(url);
      imageBitmaps.forEach(bmp => { try { bmp.close(); } catch {} });
    } catch (err) {
      console.error("Error generating APNG:", err);
      alert("Error generating APNG. Check console for details.");
    } finally {
      setIsGenerating(false);
    }
  };

  const generateWebP = async () => {
    if (frames.length === 0) return;
    setIsGenerating(true);
    setGeneratedApng(null);
    setResultSize(null);
    try {
      const { canvas, ctx, imageBitmaps, width, height } = await createFrameRenderContext(frames);
      const webpFrames: { image: Blob; duration: number }[] = [];

      for (let i = 0; i < frames.length; i++) {
        renderFrameToCanvas(ctx, imageBitmaps[i], frames[i], width, height);
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', webpQuality));
        if (blob) {
            webpFrames.push({ image: blob, duration: frames[i].delay });
        }
      }

      const finalBlob = await assembleWebP(webpFrames, width, height);
      setResultSize(formatSize(finalBlob.size));
      const url = URL.createObjectURL(finalBlob);
      setGeneratedWebP(url);
      imageBitmaps.forEach(bmp => { try { bmp.close(); } catch {} });
    } catch (err) {
      console.error("Error generating WebP:", err);
      alert("Error generating WebP. Check console.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <div className="header-titles">
          <h1>Animated Image Creator</h1>
          <p className="header-subtitle">
            Professional client-side tool to convert static images and APNG files
            into high-quality animations. Supports PNG, JPG, WebP, and APNG import.
          </p>
        </div>
        <div className="header-actions">
          <a
            href="https://github.com/UNLINEARITY/Animated-Image-Creator"
            target="_blank"
            rel="noopener noreferrer"
            className="header-icon-link"
            title="View on GitHub"
          >
            <Github size={20} />
          </a>
          <button className="theme-toggle" onClick={toggleTheme} title="Toggle Theme">
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </div>
      </header>

      <div
        className={`dropzone ${isDraggingFile ? 'active' : ''}`}
        onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={48} strokeWidth={1.5} className="dropzone-icon" />
        <div>
          <h3 style={{margin: '0 0 0.5rem 0', color: 'var(--text-primary)'}}>Drag & drop images here</h3>
          <p style={{margin: 0, fontSize: '0.9rem'}}>Supports PNG, JPG, WebP, APNG • or click to browse files</p>
        </div>
        <input type="file" ref={fileInputRef} className="file-input" multiple accept="image/*,.apng,.webp" onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {frames.length > 0 && (
        <>
          <div className="controls-bar">
            <div className="control-group">
              <Clock size={18} />
              <label>Global Delay (ms):</label>
              <input
                type="number"
                className="frame-delay-input"
                style={{width: '70px', padding: '0.4rem'}}
                value={globalDelay}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setGlobalDelay(val);
                  setFrames(prev => prev.map(f => ({ ...f, delay: val })));
                }}
              />
            </div>

            <div style={{display: 'flex', gap: '1rem'}}>
              <button className="btn btn-danger" onClick={handleClearAll}>
                <Trash2 size={18} /> Clear All
              </button>

              <button className="btn btn-secondary" onClick={handleSmartAlign} title="Auto fit larger images to base frame">
                <Wand2 size={18} /> Smart Align
              </button>

              <div style={{display: 'flex', gap: '0.5rem'}}>
                <button className="btn btn-primary" onClick={generateAPNG} disabled={isGenerating} title="Generate APNG File">
                  {isGenerating ? <span className="loading-spinner" style={{width: '18px', height: '18px'}}></span> : <><Play size={18} fill="currentColor" /> APNG</>}
                </button>
                <button className="btn btn-primary" onClick={generateWebP} disabled={isGenerating} title="Generate WebP File">
                  {isGenerating ? <span className="loading-spinner" style={{width: '18px', height: '18px'}}></span> : <><FileVideo size={18} /> WebP</>}
                </button>
              </div>
            </div>
          </div>

          <div className="frame-list">
            {frames.map((frame, index) => (
              <div
                key={frame.id}
                className={`frame-item ${index === 0 ? 'base-frame' : ''} ${draggedFrameId === frame.id ? 'dragging' : ''}`}
                draggable
                onDragStart={() => handleSortStart(frame.id)}
                onDragOver={(e) => handleSortOver(e, frame.id)}
                onDragEnd={handleSortEnd}
                style={{ animationDelay: `${Math.min(index * FRAME_ANIMATION_DELAY_STEP, 0.5)}s` }}
              >
                {index === 0 && <span className="base-badge">Base</span>}
                <button className="remove-frame-btn" onClick={() => removeFrame(frame.id)} title="Remove Frame">
                  <X size={14} />
                </button>

                <div
                  className="frame-preview-container"
                  onClick={() => index !== 0 && setEditingFrame(frame.id)}
                  title={index === 0 ? "Base frame defines canvas size" : "Click to adjust position"}
                >
                  <img src={frame.previewUrl} className="frame-preview" alt={`Frame ${index + 1}`} />
                  {index !== 0 && (
                    <div className="edit-overlay">
                      <Move size={24} />
                    </div>
                  )}
                </div>

                <div className="frame-meta">
                  <span className="frame-index">#{index + 1}</span>
                  <div className="control-group" style={{gap: '0.4rem'}}>
                    <Clock size={14} color="var(--text-secondary)" />
                    <input
                      type="number"
                      className="frame-delay-input"
                      value={frame.delay}
                      onChange={(e) => updateFrameDelay(frame.id, parseInt(e.target.value) || 0)}
                      title="Frame Delay (ms)"
                    />
                  </div>
                </div>
                <div className="frame-details">
                  <span>{frame.width}·{frame.height}</span>
                  <span>{frame.fileType}&nbsp;{formatSize(frame.fileSize)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {editingFrame && (() => {
        const frame = frames.find(f => f.id === editingFrame);
        if (!frame) return null;
        return <EditModal frame={frame} baseWidth={frames[0].width} baseHeight={frames[0].height} onSave={saveFrameOffset} onClose={() => setEditingFrame(null)} />;
      })()}

      {(generatedApng || generatedWebP) && (() => {
        const src = generatedApng || generatedWebP!;
        return (
        <div className="result-section">
          <h2 style={{color: 'var(--text-primary)', marginBottom: '1rem'}}>
            🎉 {generatedApng ? 'APNG' : 'WebP'} Ready!
          </h2>

          <img src={src} className="result-preview" alt="Generated Animation" />

          <div className="result-controls" style={{marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center'}}>
            {resultSize && (
               <span style={{fontSize: '0.9rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '4px 12px', borderRadius: '12px', border: '1px solid var(--border-color)'}}>
                 Size: {resultSize}
               </span>
            )}

            <div style={{width: '100%', maxWidth: '400px'}}>
              {generatedApng ? (
                <div>
                  <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '0.5rem'}}>
                    <label style={{fontSize: '0.875rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap'}}>APNG Compression:</label>
                    <input
                      type="range"
                      min="0"
                      max="9"
                      step="1"
                      value={apngCompression}
                      onChange={(e) => setApngCompression(parseInt(e.target.value))}
                      style={{flex: 1}}
                    />
                    <span style={{fontSize: '0.875rem', color: 'var(--text-primary)', minWidth: '32px'}}>
                      {apngCompression}
                    </span>
                  </div>
                  <div style={{display: 'flex', gap: '0.5rem', justifyContent: 'center'}}>
                    <button className="btn btn-primary" onClick={generateAPNG} disabled={isGenerating} title="Re-generate APNG">
                      {isGenerating ? <span className="loading-spinner" style={{width: '18px', height: '18px'}}></span> : <>↻ APNG</>}
                    </button>
                    <button className="btn btn-secondary" onClick={generateWebP} disabled={isGenerating} title="Generate WebP instead">
                      {isGenerating ? <span className="loading-spinner" style={{width: '18px', height: '18px', borderColor: 'var(--text-secondary)', borderTopColor: 'var(--text-primary)'}}></span> : <><FileVideo size={18} /> WebP</>}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '0.5rem'}}>
                    <label style={{fontSize: '0.875rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap'}}>WebP Quality:</label>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={webpQuality}
                      onChange={(e) => setWebpQuality(parseFloat(e.target.value))}
                      style={{flex: 1}}
                    />
                    <span style={{fontSize: '0.875rem', color: 'var(--text-primary)', minWidth: '32px'}}>
                      {Math.round(webpQuality * 100)}%
                    </span>
                  </div>
                  <div style={{display: 'flex', gap: '0.5rem', justifyContent: 'center'}}>
                    <button className="btn btn-primary" onClick={generateWebP} disabled={isGenerating} title="Re-generate WebP">
                      {isGenerating ? <span className="loading-spinner" style={{width: '18px', height: '18px'}}></span> : <>↻ WebP</>}
                    </button>
                    <button className="btn btn-secondary" onClick={generateAPNG} disabled={isGenerating} title="Generate APNG instead">
                      {isGenerating ? <span className="loading-spinner" style={{width: '18px', height: '18px', borderColor: 'var(--text-secondary)', borderTopColor: 'var(--text-primary)'}}></span> : <><Play size={18} fill="currentColor" /> APNG</>}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="filename-input-group" style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                <FilePenLine size={18} color="var(--text-secondary)" />
                <input
                  type="text"
                  value={exportFileName}
                  onChange={(e) => setExportFileName(e.target.value)}
                  className="file-input-text"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    padding: '4px',
                    fontSize: '1rem',
                    textAlign: 'center',
                    outline: 'none',
                    minWidth: '150px'
                  }}
                />
                <span style={{color: 'var(--text-secondary)'}}>.{generatedApng ? 'png' : 'webp'}</span>
            </div>

            <a href={src} download={`${exportFileName}.${generatedApng ? 'png' : 'webp'}`} style={{textDecoration: 'none'}}>
              <button className="btn btn-primary" style={{padding: '0.8rem 2rem', fontSize: '1.1rem'}}>
                <Download size={20} /> Download
              </button>
            </a>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
export default App;
