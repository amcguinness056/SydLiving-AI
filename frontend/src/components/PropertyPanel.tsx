import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  X, BedDouble, Bath, MapPin, Waves, CalendarDays, Maximize, Minimize, 
  Train, ShieldCheck, Heart, DollarSign, Repeat, Compass, Sparkles, Send, 
  Clock, Car, ExternalLink, ChevronLeft, ChevronRight, Camera, Phone, 
  Building2, Check, Layers
} from "lucide-react";
import { type Property } from "../api/client";
import { cn } from "../lib/utils";

interface PropertyPanelProps {
  property: Property;
  onClose: () => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  selectedHubName?: string;
  onAskAgent?: (query: string, property: Property) => void;
}

export function PropertyPanel({ 
  property, 
  onClose, 
  isMaximized, 
  onToggleMaximize,
  isFavorite,
  onToggleFavorite,
  selectedHubName,
  onAskAgent
}: PropertyPanelProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [customQuestion, setCustomQuestion] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const heroImgRef = useRef<HTMLDivElement>(null);
  const heroBlurRef = useRef<HTMLDivElement>(null);
  const heroDimRef = useRef<HTMLDivElement>(null);
  const isScrolledRef = useRef(false);
  const isTickingRef = useRef(false);
  const fallbackImage = "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=800&auto=format&fit=crop&q=80";

  // Build the list of available images (deduped)
  const images: string[] = (() => {
    const list: string[] = [];
    if (property.image_urls && Array.isArray(property.image_urls) && property.image_urls.length > 0) {
      for (const url of property.image_urls) {
        if (url && !list.includes(url)) list.push(url);
      }
    }
    if (property.photo_url && !list.includes(property.photo_url)) {
      list.unshift(property.photo_url);
    }
    return list.length > 0 ? list : [fallbackImage];
  })();

  // Reset image carousel index and scroll position whenever property or view mode changes
  useEffect(() => {
    setCurrentImageIndex(0);
    setIsScrolled(false);
    isScrolledRef.current = false;
    isTickingRef.current = false;
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
    if (heroImgRef.current) {
      heroImgRef.current.style.transform = "translate3d(0, 0px, 0) scale(1)";
    }
    if (heroBlurRef.current) {
      heroBlurRef.current.style.opacity = "0";
    }
    if (heroDimRef.current) {
      heroDimRef.current.style.opacity = "0";
    }
  }, [property?.id, isMaximized]);

  // Buttery 120fps/60fps compositor scroll handler:
  // 1. Ticking throttle prevents frame starvation from high-frequency input events
  // 2. Opacity crossfade of pre-rendered blur texture avoids costly GPU Gaussian filter recalculations on large viewports
  // 3. Dynamic maxRange adapts to side panel (320px) vs enlarged modal (480px)
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const top = scrollRef.current.scrollTop;

    // Toggle frosted header bar only when crossing 100px boundary to avoid component re-renders
    const shouldBeScrolled = top > 100;
    if (shouldBeScrolled !== isScrolledRef.current) {
      isScrolledRef.current = shouldBeScrolled;
      setIsScrolled(shouldBeScrolled);
    }

    if (!isTickingRef.current) {
      isTickingRef.current = true;
      requestAnimationFrame(() => {
        isTickingRef.current = false;
        if (!scrollRef.current) return;
        const currentTop = scrollRef.current.scrollTop;

        const maxRange = isMaximized ? 480 : 320;
        const clamped = Math.min(Math.max(currentTop, 0), maxRange);
        const progress = clamped / maxRange; // 0.0 -> 1.0

        const translateY = (clamped * 0.35).toFixed(1);
        const scale = (1 - progress * 0.08).toFixed(3); // 1.0 -> 0.92

        if (heroImgRef.current) {
          heroImgRef.current.style.transform = `translate3d(0, ${translateY}px, 0) scale(${scale})`;
        }
        if (heroBlurRef.current) {
          heroBlurRef.current.style.opacity = progress.toFixed(3);
        }
        if (heroDimRef.current) {
          heroDimRef.current.style.opacity = (progress * 0.55).toFixed(3);
        }
      });
    }
  }, [isMaximized]);

  const handleNextImage = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const handlePrevImage = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  // Keyboard navigation for carousel & lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") handleNextImage();
      if (e.key === "ArrowLeft") handlePrevImage();
      if (e.key === "Escape" && isLightboxOpen) setIsLightboxOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNextImage, handlePrevImage, isLightboxOpen]);

  if (!property) return null;

  const hasCommuteData = property.commute_duration_minutes !== undefined && property.commute_duration_minutes !== null;
  const weeklyOpal = property.estimated_opal_fare ? (property.estimated_opal_fare * 10).toFixed(2) : "38.00";
  const monthlyRent = Math.round((property.weekly_rent * 52) / 12);
  const bondAmount = Math.round(property.weekly_rent * 4);

  return (
    <div className={cn("h-full w-full flex flex-col bg-white dark:bg-slate-900 relative overflow-hidden", isMaximized ? "" : "animate-in slide-in-from-right-8 duration-300 border-l border-white/60 dark:border-slate-800")}>
      
      {/* ========================================================================= */}
      {/* 1. PERSISTENT TOP NAVIGATION BAR (Adapts smoothly from transparent to glass) */}
      {/* ========================================================================= */}
      <div className={cn(
        "absolute top-0 left-0 right-0 z-40 h-14 sm:h-16 px-4 flex items-center justify-between transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        isScrolled 
          ? "bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800 shadow-sm text-slate-900 dark:text-white" 
          : "bg-gradient-to-b from-black/60 via-black/20 to-transparent text-white"
      )}>
        {/* Scrolled compact property teaser */}
        <div className={cn(
          "flex items-center gap-2.5 min-w-0 transition-all duration-300",
          isScrolled ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"
        )}>
          <div 
            onClick={() => setIsLightboxOpen(true)}
            className="w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-slate-300 dark:border-slate-700 shadow-xs cursor-pointer"
          >
            <img 
              src={images[currentImageIndex] || fallbackImage} 
              alt=""
              className="w-full h-full object-cover" 
            />
          </div>
          <div className="min-w-0">
            <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate leading-tight">
              {property.title}
            </h4>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">${property.weekly_rent}/wk</span>
              <span>•</span>
              <span className="truncate">{property.suburb}</span>
            </div>
          </div>
        </div>

        {/* Top-Right Control Actions */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <button 
            onClick={() => onToggleFavorite && onToggleFavorite(property.id)}
            className={cn(
              "p-2 rounded-full transition-all hover:scale-105 active:scale-95 shadow-xs border cursor-pointer",
              isFavorite 
                ? "bg-rose-500 text-white border-rose-400/50 shadow-rose-500/20" 
                : isScrolled
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:text-rose-500"
                  : "bg-black/45 hover:bg-black/65 text-white border-white/20 backdrop-blur-md"
            )}
            title={isFavorite ? "Remove from shortlist" : "Add to shortlist"}
            aria-label={isFavorite ? "Remove from shortlist" : "Add to shortlist"}
          >
            <Heart className={cn("w-4 h-4", isFavorite && "fill-white")} />
          </button>

          {onToggleMaximize && (
            <button 
              onClick={onToggleMaximize}
              className={cn(
                "flex items-center gap-1.5 p-2 sm:px-3 rounded-full transition-all hover:scale-105 active:scale-95 shadow-xs border cursor-pointer",
                isMaximized 
                  ? "bg-blue-600 text-white border-blue-500 shadow-blue-500/30"
                  : isScrolled
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:text-blue-600"
                    : "bg-black/45 hover:bg-black/65 text-white border-white/20 backdrop-blur-md"
              )}
              title={isMaximized ? "Restore split view (Esc)" : "Enlarge details"}
              aria-label={isMaximized ? "Restore split view" : "Enlarge details"}
            >
              {isMaximized ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              <span className="text-xs font-bold hidden sm:inline">
                {isMaximized ? "Minimize" : "Enlarge"}
              </span>
            </button>
          )}

          <button 
            onClick={onClose}
            className={cn(
              "p-2 rounded-full transition-all hover:scale-105 active:scale-95 shadow-xs border cursor-pointer",
              isScrolled
                ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                : "bg-black/45 hover:bg-black/65 text-white border-white/20 backdrop-blur-md"
            )}
            title="Close details"
            aria-label="Close details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SCROLLABLE CONTAINER WITH NATIVE SMOOTH SCROLLING */}
      {/* ========================================================================= */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full w-full overflow-y-auto overscroll-y-contain custom-scrollbar relative flex flex-col"
      >
        {/* ======================================================================= */}
        {/* HERO SECTION: Sticky backdrop with GPU parallax & ambient blur        */}
        {/* ======================================================================= */}
        <div className={cn(
          "w-full sticky top-0 z-0 bg-slate-950 overflow-hidden shrink-0 select-none",
          isMaximized ? "h-[50vh] sm:h-[58vh] min-h-[360px] max-h-[520px]" : "h-[42vh] sm:h-[46vh] min-h-[290px] max-h-[380px]"
        )}>
          {/* Parallax & Scale Container */}
          <div 
            ref={heroImgRef}
            className="absolute inset-0 w-full h-full will-change-transform origin-top"
          >
            {/* Crisp Base Image */}
            <img 
              src={images[currentImageIndex] || fallbackImage} 
              alt={`${property.title} photo ${currentImageIndex + 1}`} 
              onError={(e) => {
                (e.target as HTMLImageElement).src = fallbackImage;
              }}
              onClick={() => setIsLightboxOpen(true)}
              className="w-full h-full object-cover cursor-zoom-in" 
            />

            {/* Pre-blurred Crossfade Layer: 100% GPU compositor opacity blend, zero shader recalculations */}
            <div 
              ref={heroBlurRef}
              className="absolute inset-0 w-full h-full pointer-events-none will-change-opacity overflow-hidden"
              style={{ opacity: 0 }}
            >
              <img 
                src={images[currentImageIndex] || fallbackImage} 
                alt="" 
                onError={(e) => {
                  (e.target as HTMLImageElement).src = fallbackImage;
                }}
                className="w-full h-full object-cover blur-xl scale-105" 
              />
            </div>

            {/* Ambient Dimming Overlay */}
            <div 
              ref={heroDimRef}
              className="absolute inset-0 bg-slate-950 pointer-events-none will-change-opacity"
              style={{ opacity: 0 }}
            />
          </div>

          {/* Vignette Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/30 pointer-events-none" />

          {/* Top-Left Floating Photo Badge */}
          <div className="absolute top-16 left-4 flex items-center gap-1.5 z-20 pointer-events-none">
            <span className="px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md text-white text-[11px] font-semibold border border-white/20 shadow-md flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-slate-300" />
              <span>{currentImageIndex + 1} / {images.length}</span>
            </span>
            {property.property_type && (
              <span className="px-2.5 py-1 rounded-full bg-blue-600/90 backdrop-blur-md text-white text-[11px] font-bold border border-blue-400/30 shadow-md">
                {property.property_type}
              </span>
            )}
          </div>

          {/* Carousel Arrows (Active on photo) */}
          {images.length > 1 && (
            <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 flex justify-between z-20 pointer-events-none">
              <button 
                onClick={handlePrevImage}
                aria-label="Previous photo"
                className="p-2 sm:p-2.5 rounded-full bg-black/55 hover:bg-black/80 backdrop-blur-md text-white transition-all hover:scale-110 active:scale-95 shadow-lg border border-white/20 cursor-pointer pointer-events-auto"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={handleNextImage}
                aria-label="Next photo"
                className="p-2 sm:p-2.5 rounded-full bg-black/55 hover:bg-black/80 backdrop-blur-md text-white transition-all hover:scale-110 active:scale-95 shadow-lg border border-white/20 cursor-pointer pointer-events-auto"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Bottom Photo Gradient Edge */}
          <div className="absolute bottom-10 left-4 right-4 flex items-end justify-between z-20 pointer-events-none">
            <div className="bg-slate-900/90 backdrop-blur-md text-white px-3.5 py-1.5 rounded-2xl shadow-xl border border-white/20 inline-flex items-baseline gap-1.5 pointer-events-auto">
              <span className="text-xl sm:text-2xl font-black">${property.weekly_rent}</span>
              <span className="text-xs font-semibold text-slate-300">/ week</span>
              <span className="text-[10px] text-slate-400 font-medium pl-1 border-l border-slate-700 hidden sm:inline">
                ~${monthlyRent.toLocaleString()}/mo
              </span>
            </div>

            <div className="bg-emerald-600 text-white backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-md border border-emerald-400/40 pointer-events-auto">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified Listing</span>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* DETAILS SHEET: Slides naturally over the hero on scroll               */}
        {/* ======================================================================= */}
        <div className="relative z-10 -mt-6 sm:-mt-8 rounded-t-[28px] bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shadow-2xl flex flex-col">
          
          {/* Thumbnails Ribbon (if 2+ photos exist) */}
          {images.length > 1 && (
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-2 overflow-x-auto custom-scrollbar rounded-t-[28px]">
              {images.map((imgUrl, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImageIndex(idx)}
                  className={cn(
                    "relative w-14 h-10 rounded-lg overflow-hidden shrink-0 border transition-all cursor-pointer",
                    currentImageIndex === idx 
                      ? "ring-2 ring-blue-600 border-white shadow-sm scale-105" 
                      : "opacity-60 hover:opacity-100 border-transparent"
                  )}
                >
                  <img 
                    src={imgUrl} 
                    alt={`Thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover" 
                    onError={(e) => { (e.target as HTMLImageElement).src = fallbackImage; }}
                  />
                </button>
              ))}
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 shrink-0 pl-1">
                {images.length} photos
              </span>
            </div>
          )}

          {/* Core Content Body */}
          <div className="p-4 sm:p-6 space-y-5 text-slate-800 dark:text-slate-100 flex-1">
            
            {/* Title, Suburb & Street Address */}
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white leading-snug mb-1">
                {property.title}
              </h2>
              <p className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5 text-xs sm:text-sm font-medium">
                <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>{property.address}</span>
              </p>
            </div>

            {/* Upcoming Open Home Inspection Banner */}
            {property.inspection_time && (
              <div className="flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
                      Upcoming Inspection
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      {property.inspection_time}
                    </span>
                  </div>
                </div>
                {property.external_url && (
                  <a
                    href={property.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <span>Domain</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )}

            {/* Key Metrics Grid (Beds, Baths, Parking, Beach) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
              <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col items-center justify-center gap-1 shadow-2xs">
                <BedDouble className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                  {property.bedrooms === 0 ? "Studio" : `${property.bedrooms} Beds`}
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col items-center justify-center gap-1 shadow-2xs">
                <Bath className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">{property.bathrooms} Baths</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col items-center justify-center gap-1 shadow-2xs">
                <Car className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs text-center truncate max-w-full">
                  {property.parking_spaces ? `${property.parking_spaces} Parking` : "Street Parking"}
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col items-center justify-center gap-1 shadow-2xs">
                <Waves className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">{property.distance_to_beach_km.toFixed(1)} km Beach</span>
              </div>
            </div>

            {/* Financial & Lease Summary Card */}
            <div className="bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
                <span className="flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Rental Financials</span>
                </span>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  AUD standard rates
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white dark:bg-slate-900/80 p-2 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Weekly</span>
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white">${property.weekly_rent}</span>
                </div>
                <div className="bg-white dark:bg-slate-900/80 p-2 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Calendar Month</span>
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white">${monthlyRent.toLocaleString()}</span>
                </div>
                <div className="bg-white dark:bg-slate-900/80 p-2 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Bond (4 Wks)</span>
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white">${bondAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Structured Amenities & Features Chips */}
            {property.features_list && property.features_list.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                  <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Key Amenities & Features</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {property.features_list.map((feature, idx) => (
                    <span 
                      key={idx}
                      className="px-2.5 py-1 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 border border-blue-200/80 dark:border-blue-900/60 text-[11px] font-semibold flex items-center gap-1"
                    >
                      <Check className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                      <span>{feature}</span>
                    </span>
                  ))}
                  {property.pet_friendly && !property.features_list.some(f => f.toLowerCase().includes("pet")) && (
                    <span className="px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-900/60 text-[11px] font-bold flex items-center gap-1">
                      🐾 Pet-Friendly Approved
                    </span>
                  )}
                  {property.has_air_con && !property.features_list.some(f => f.toLowerCase().includes("air")) && (
                    <span className="px-2.5 py-1 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-200 border border-sky-200 dark:border-sky-900/60 text-[11px] font-bold flex items-center gap-1">
                      ❄️ Air Conditioned
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Managing Real Estate Agency & Agent Card */}
            {(property.agency_name || property.agent_name) && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3 min-w-0">
                  {property.agent_photo ? (
                    <img 
                      src={property.agent_photo} 
                      alt={property.agent_name || "Agent"} 
                      className="w-11 h-11 rounded-full object-cover border-2 border-white dark:border-slate-700 shadow-xs shrink-0"
                    />
                  ) : property.agency_logo ? (
                    <div className="w-12 h-10 rounded-xl bg-white dark:bg-slate-900 p-1 flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0">
                      <img 
                        src={property.agency_logo} 
                        alt={property.agency_name || "Agency"} 
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">
                      {property.agency_name || "Managing Agency"}
                    </span>
                    <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white block truncate">
                      {property.agent_name || "Licensed Property Manager"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {property.agent_phone && (
                    <a
                      href={`tel:${property.agent_phone.replace(/\s+/g, '')}`}
                      className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 transition-colors shadow-2xs"
                      title={`Call ${property.agent_phone}`}
                      aria-label="Call property agent"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  )}
                  {property.external_url && (
                    <a
                      href={property.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 transition-colors shadow-xs"
                    >
                      <span>Enquire</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Enriched Commute Intelligence Card */}
            <div className="bg-blue-50/50 dark:bg-slate-900 border border-blue-100/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
                  <Train className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
                  <span>{selectedHubName ? `Transit to ${selectedHubName}` : "Transit & Connectivity"}</span>
                </div>
                {hasCommuteData && (
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white font-extrabold text-xs shadow-xs">
                    {property.commute_duration_minutes} mins
                  </span>
                )}
              </div>

              {hasCommuteData ? (
                <div className="space-y-2 pt-1 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-blue-100/60 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
                      <Compass className="w-3.5 h-3.5 text-blue-500" /> Primary Line
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-200">{property.transit_mode || "Public Transit"}</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-blue-100/60 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
                      <Repeat className="w-3.5 h-3.5 text-blue-500" /> Route Transfers
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-300">
                      {property.transfers === 0 ? "Direct (0 transfers)" : `${property.transfers} transfer`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-blue-100/60 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-500" /> Est. Weekly Opal (10 trips)
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">${weeklyOpal}/wk</span>
                  </div>

                  {property.route_summary && (
                    <p className="text-[11px] text-slate-700 dark:text-slate-300 pt-1 leading-relaxed bg-white/70 dark:bg-slate-800/70 p-2.5 rounded-xl border border-blue-100/50 dark:border-slate-700/60">
                      <strong className="text-blue-700 dark:text-blue-300 font-semibold">Route: </strong>
                      {property.route_summary}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed font-medium">
                  Select a destination hub above to calculate exact door-to-door transit schedules and weekly Opal costs.
                </p>
              )}
            </div>

            {/* Property Overview / Description */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Property Overview</h3>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-xs sm:text-[13px]">
                {property.description || `Exceptional ${property.bedrooms} bedroom residence in ${property.suburb} offering authentic Sydney living. Positioned ${property.distance_to_beach_km.toFixed(1)} km from coastal beaches with convenient access to dining precincts, green parks, and frequent public transport.`}
              </p>
            </div>

            {/* Ask Kai AI Concierge Card */}
            <div className="bg-slate-50/90 dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 space-y-3 shadow-xs">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 dark:text-white text-xs">
                    Ask Kai About This Home
                  </h4>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">
                    Deep Agent evaluation of transit, rent value & suburb vibe
                  </p>
                </div>
              </div>

              {/* Quick Prompt Chips */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => onAskAgent?.(`What's the door-to-door transit commute from [${property.title}](property:${property.id}) in ${property.suburb} into the Sydney CBD or major employment hubs? Break down the exact lines, transfers, and travel times.`, property)}
                  className="text-left p-2 rounded-xl bg-white dark:bg-slate-900/90 hover:bg-blue-50/70 dark:hover:bg-blue-950/40 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-300 text-[11px] font-medium transition-all flex items-center gap-1.5 group shadow-2xs cursor-pointer"
                >
                  <Train className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span className="truncate">Commute breakdown</span>
                </button>

                <button
                  type="button"
                  onClick={() => onAskAgent?.(`How is the coastal and beach lifestyle near [${property.title}](property:${property.id})? What's the walk like to the beach and coastal parks?`, property)}
                  className="text-left p-2 rounded-xl bg-white dark:bg-slate-900/90 hover:bg-blue-50/70 dark:hover:bg-blue-950/40 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-300 text-[11px] font-medium transition-all flex items-center gap-1.5 group shadow-2xs cursor-pointer"
                >
                  <Waves className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span className="truncate">Beach & coastal vibe</span>
                </button>

                <button
                  type="button"
                  onClick={() => onAskAgent?.(`Is $${property.weekly_rent}/week good value for this ${property.bedrooms}BR ${property.bathrooms}Bath property in ${property.suburb}? Compare it to average rental benchmarks in the area.`, property)}
                  className="text-left p-2 rounded-xl bg-white dark:bg-slate-900/90 hover:bg-blue-50/70 dark:hover:bg-blue-950/40 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-300 text-[11px] font-medium transition-all flex items-center gap-1.5 group shadow-2xs cursor-pointer"
                >
                  <DollarSign className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="truncate">Fair rent analysis</span>
                </button>

                <button
                  type="button"
                  onClick={() => onAskAgent?.(`What are the nearest cafes, supermarkets, gyms, and dining spots within walking distance of [${property.title}](property:${property.id}) on ${property.address}?`, property)}
                  className="text-left p-2 rounded-xl bg-white dark:bg-slate-900/90 hover:bg-blue-50/70 dark:hover:bg-blue-950/40 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-300 text-[11px] font-medium transition-all flex items-center gap-1.5 group shadow-2xs cursor-pointer"
                >
                  <Compass className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="truncate">Local cafes & spots</span>
                </button>
              </div>

              {/* Custom Question Input */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!customQuestion.trim()) return;
                  onAskAgent?.(`Regarding [${property.title}](property:${property.id}) in ${property.suburb}: ${customQuestion.trim()}`, property);
                  setCustomQuestion("");
                }}
                className="relative flex items-center pt-1"
              >
                <input 
                  type="text"
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  placeholder="Ask Kai anything about this home..."
                  className="w-full pl-3 pr-10 py-2 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs"
                />
                <button
                  type="submit"
                  disabled={!customQuestion.trim()}
                  className="absolute right-1 p-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg transition-colors shadow-xs disabled:shadow-none cursor-pointer"
                  title="Send to Kai"
                >
                  <Send className="w-3 h-3" />
                </button>
              </form>
            </div>
            
            {/* Footer Actions */}
            <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <CalendarDays className="w-4 h-4 text-emerald-500" />
                {property.available_date ? `Available from ${property.available_date}` : "Available Now"}
              </div>
              
              <div className="flex items-center gap-2">
                {property.external_url && (
                  <a 
                    href={property.external_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-200 dark:shadow-blue-950/50 transition-all hover:scale-[1.02] active:scale-[0.98] text-xs flex items-center justify-center gap-1.5"
                  >
                    <span>View on Domain</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. FULLSCREEN PHOTO LIGHTBOX MODAL */}
      {/* ========================================================================= */}
      {isLightboxOpen && (
        <div 
          className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex flex-col justify-between p-4 sm:p-6 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="High-resolution photo lightbox"
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between z-10 text-white">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base">{property.title}</span>
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs font-medium">
                Photo {currentImageIndex + 1} of {images.length}
              </span>
            </div>
            <button 
              onClick={() => setIsLightboxOpen(false)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Close full-screen photos (Esc)"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Central Image View */}
          <div className="relative flex-1 flex items-center justify-center py-4 overflow-hidden">
            <img 
              src={images[currentImageIndex] || fallbackImage} 
              alt={`${property.title} full view ${currentImageIndex + 1}`} 
              className="max-h-full max-w-full object-contain rounded-xl shadow-2xl select-none" 
            />

            {images.length > 1 && (
              <>
                <button 
                  onClick={handlePrevImage}
                  className="absolute left-2 sm:left-6 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white transition-all hover:scale-110 cursor-pointer border border-white/20"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button 
                  onClick={handleNextImage}
                  className="absolute right-2 sm:right-6 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white transition-all hover:scale-110 cursor-pointer border border-white/20"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          {/* Bottom Thumbnails */}
          {images.length > 1 && (
            <div className="flex items-center justify-center gap-2 overflow-x-auto py-2 px-4 z-10 custom-scrollbar">
              {images.map((imgUrl, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImageIndex(idx)}
                  className={cn(
                    "w-16 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-all cursor-pointer",
                    currentImageIndex === idx 
                      ? "border-blue-500 scale-105 shadow-md" 
                      : "border-transparent opacity-50 hover:opacity-100"
                  )}
                >
                  <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
