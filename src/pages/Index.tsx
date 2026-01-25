import { useRef, useEffect } from "react";
import akzLogo from "@/assets/akz-logo.png";
import CheckInForm from "@/components/CheckInForm";

const Index = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const directionRef = useRef<1 | -1>(1); // 1 = forward, -1 = backward
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Set playback speed to 70%
    video.playbackRate = 0.7;

    // Ping-Pong loop implementation
    const handlePingPong = () => {
      if (!video) return;

      if (directionRef.current === 1) {
        // Forward playback - let video play naturally
        if (video.currentTime >= video.duration - 0.05) {
          // Reached end, switch to reverse
          directionRef.current = -1;
          video.pause();
        }
      }

      if (directionRef.current === -1) {
        // Reverse playback - manually decrement currentTime
        video.currentTime = Math.max(0, video.currentTime - 0.016 * 0.7); // ~60fps adjusted for speed
        
        if (video.currentTime <= 0.05) {
          // Reached beginning, switch to forward
          directionRef.current = 1;
          video.play();
        }
      }

      animationRef.current = requestAnimationFrame(handlePingPong);
    };

    // Start the ping-pong loop
    video.addEventListener('play', () => {
      if (!animationRef.current) {
        animationRef.current = requestAnimationFrame(handlePingPong);
      }
    });

    // Prevent default loop behavior - we handle it manually
    video.loop = false;

    // Handle video end to start reverse
    video.addEventListener('ended', () => {
      directionRef.current = -1;
      video.pause();
    });

    // Start animation frame loop
    animationRef.current = requestAnimationFrame(handlePingPong);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      {/* High-End Aurora Video Background */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="fixed inset-0 w-screen h-screen object-cover z-0"
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
