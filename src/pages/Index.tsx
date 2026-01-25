import { useRef, useEffect, useState } from "react";
import akzLogo from "@/assets/akz-logo.png";
import CheckInForm from "@/components/CheckInForm";

const Index = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoOpacity, setVideoOpacity] = useState(1);
  const fadeCheckRef = useRef<number | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Set playback speed to 80%
    video.playbackRate = 0.8;

    // Fade-loop implementation: fade out near end, reset, fade in
    const checkForFade = () => {
      if (!video) return;

      const timeRemaining = video.duration - video.currentTime;
      
      // Start fade 0.5 seconds before end
      if (timeRemaining <= 0.5 && timeRemaining > 0) {
        setVideoOpacity(0);
      }

      fadeCheckRef.current = requestAnimationFrame(checkForFade);
    };

    // Handle video end: reset to beginning and fade back in
    const handleEnded = () => {
      video.currentTime = 0;
      video.play();
      // Small delay to ensure smooth transition
      setTimeout(() => {
        setVideoOpacity(1);
      }, 50);
    };

    video.addEventListener('ended', handleEnded);
    
    // Disable native loop - we handle it manually
    video.loop = false;

    // Start fade check loop
    fadeCheckRef.current = requestAnimationFrame(checkForFade);

    return () => {
      video.removeEventListener('ended', handleEnded);
      if (fadeCheckRef.current) {
        cancelAnimationFrame(fadeCheckRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      {/* High-End Aurora Video Background with Fade Loop */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="fixed inset-0 w-screen h-screen object-cover z-0"
        style={{
          opacity: videoOpacity,
          transition: 'opacity 0.5s ease-out'
        }}
        poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Crect fill='%23000'/%3E%3C/svg%3E"
      >
        <source src="/aurora.mp4" type="video/mp4" />
      </video>
      
      {/* Dark Overlay for Readability */}
      <div className="fixed inset-0 bg-black/40 z-[1]" />
      
      <div className="relative z-10 container max-w-md mx-auto px-6 py-10 pb-16 min-h-screen">
        {/* Header with Logo Glow */}
        <header className="text-center mb-16 relative">
          {/* Logo Glow Effect */}
          <div className="logo-glow" />
          
          <div className="relative z-10 flex justify-center mb-8">
            <img 
              src={akzLogo} 
              alt="Augen Kompetenz Zentrum Logo" 
              className="w-56 h-auto object-contain"
              style={{
                mixBlendMode: 'screen',
                filter: 'drop-shadow(0 0 30px rgba(57, 224, 120, 0.2))'
              }}
            />
          </div>
          <p className="text-white/90 text-lg font-light tracking-widest uppercase">
            Willkommen im Augenkompetenzzentrum
          </p>
          <p className="text-white/40 text-sm mt-2 tracking-wide">
            Smart Check-in für Ihren Besuch
          </p>
        </header>

        {/* Hero Section */}
        <section className="text-center mb-14">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4 leading-tight">
            Smart Check-in
          </h1>
          <p className="text-white/35 text-sm tracking-wide">
            Dauert nur 30 Sekunden.
          </p>
        </section>

        {/* Form */}
        <CheckInForm />
        
        {/* Footer Spacer */}
        <div className="h-12" />
      </div>
    </div>
  );
};

export default Index;