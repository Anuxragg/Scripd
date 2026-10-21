"use client";

import { useEffect, useRef, useState } from "react";

interface ImageCropModalProps {
  imageSrc: string;
  onCrop: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

export function ImageCropModal({ imageSrc, onCrop, onCancel }: ImageCropModalProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [baseSize, setBaseSize] = useState<{ width: number; height: number } | null>(null);
  const [cropSize, setCropSize] = useState(200);

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cropBoxRef = useRef<HTMLDivElement>(null);

  // Initialize dimensions reliably, handling cached images and page refreshes
  function initDimensions(nw: number, nh: number) {
    if (nw <= 0 || nh <= 0) return;
    const containerSize = 340;

    // Fit entire photo inside container without cropping (object-fit: contain)
    const fitScale = Math.min(containerSize / nw, containerSize / nh);
    const fitW = Math.round(nw * fitScale);
    const fitH = Math.round(nh * fitScale);

    // The crop circle diameter must not exceed photo bounds so it never goes into black bars
    const safeCropSize = Math.max(120, Math.min(fitW, fitH, 220));

    setCropSize(safeCropSize);
    setBaseSize({ width: fitW, height: fitH });
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setImageLoaded(true);
  }

  useEffect(() => {
    if (!imageSrc) return;

    let canceled = false;
    const preloader = new window.Image();
    preloader.src = imageSrc;
    preloader.onload = () => {
      if (!canceled) {
        initDimensions(preloader.naturalWidth, preloader.naturalHeight);
      }
    };
    if (preloader.complete && preloader.naturalWidth > 0) {
      requestAnimationFrame(() => {
        if (!canceled && preloader.naturalWidth > 0) {
          initDimensions(preloader.naturalWidth, preloader.naturalHeight);
        }
      });
    }

    return () => {
      canceled = true;
    };
  }, [imageSrc]);

  // Clamp pan so the crop circle never goes outside the bounds of the photo
  function getClampedPan(targetX: number, targetY: number, targetZoom: number) {
    if (!baseSize) return { x: 0, y: 0 };
    const currentW = baseSize.width * targetZoom;
    const currentH = baseSize.height * targetZoom;

    const maxPanX = Math.max(0, (currentW - cropSize) / 2);
    const maxPanY = Math.max(0, (currentH - cropSize) / 2);

    return {
      x: Math.max(-maxPanX, Math.min(maxPanX, targetX)),
      y: Math.max(-maxPanY, Math.min(maxPanY, targetY)),
    };
  }

  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging) return;
    const rawX = e.clientX - dragStart.x;
    const rawY = e.clientY - dragStart.y;
    setPan(getClampedPan(rawX, rawY, zoom));
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const rawX = touch.clientX - dragStart.x;
    const rawY = touch.clientY - dragStart.y;
    setPan(getClampedPan(rawX, rawY, zoom));
  }

  function handleTouchEnd() {
    setIsDragging(false);
  }

  function handleZoomChange(newZoom: number) {
    setZoom(newZoom);
    setPan((prev) => getClampedPan(prev.x, prev.y, newZoom));
  }

  function handleCropAndSave() {
    const img = imageRef.current;
    const cropBox = cropBoxRef.current;
    if (!img || !cropBox) return;

    // Output crisp square avatar (400x400)
    const outputSize = 400;
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cropRect = cropBox.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();

    // Scale from displayed screen pixels to natural image pixels
    const scaleToNatural = img.naturalWidth / imgRect.width;

    const sx = Math.max(0, (cropRect.left - imgRect.left) * scaleToNatural);
    const sy = Math.max(0, (cropRect.top - imgRect.top) * scaleToNatural);
    const sWidth = cropRect.width * scaleToNatural;
    const sHeight = cropRect.height * scaleToNatural;

    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, outputSize, outputSize);

    const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.92);
    onCrop(croppedDataUrl);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in duration-150"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="relative w-full max-w-[440px] rounded-3xl border border-[#2b3542] bg-[#12161c] p-6 shadow-2xl text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4">
          <h2 className="text-lg font-bold text-white tracking-tight">Crop Image</h2>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1c222b] text-[#8fa0b5] hover:bg-[#28323f] hover:text-white transition cursor-pointer text-sm"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Crop Viewport with Black Letterbox Background */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className="relative mx-auto h-[340px] w-full overflow-hidden rounded-2xl bg-black cursor-grab active:cursor-grabbing select-none flex items-center justify-center border border-[#232a35]"
        >
          {/* Base Image fitted cleanly inside container */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Crop preview"
            onLoad={(e) =>
              initDimensions(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)
            }
            draggable={false}
            style={{
              width: baseSize ? `${baseSize.width}px` : "auto",
              height: baseSize ? `${baseSize.height}px` : "auto",
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
              transition: isDragging ? "none" : "transform 0.05s ease-out",
            }}
            className="pointer-events-none select-none max-w-none max-h-none block"
          />

          {/* Crop Overlay: Square Box with Inscribed Circle Guide strictly sized to stay inside the photo */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              ref={cropBoxRef}
              style={{ width: `${cropSize}px`, height: `${cropSize}px` }}
              className="relative border border-white/80 pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
            >
              {/* Inscribed Circle guide */}
              <div className="h-full w-full rounded-full border border-white/80" />
            </div>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-[#8fa0b5]">
            <span>Zoom: {Math.round(zoom * 100)}%</span>
          </div>
          <input
            type="range"
            min="1"
            max="3"
            step="0.02"
            value={zoom}
            onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#26313f] rounded-lg appearance-none cursor-pointer accent-[#a78bfa]"
          />
        </div>

        {/* Footer Buttons */}
        <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-[#232a35]">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[#3b4756] bg-[#1a222c] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#252f3d] transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCropAndSave}
            disabled={!imageLoaded}
            className="rounded-xl bg-[#e2e8f0] px-6 py-2.5 text-xs font-bold text-black hover:bg-white transition cursor-pointer disabled:opacity-50"
          >
            Crop &amp; Save
          </button>
        </div>
      </div>
    </div>
  );
}
