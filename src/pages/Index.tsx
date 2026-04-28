import { useEffect, useRef } from "react";
import CheckInForm from "@/components/CheckInForm";
import { getStandortName, getStandortLogo } from "@/lib/standorte";

const Index = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = 0.6;
    }
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      {/* High-End Aurora Video Background - Standard HTML5 Loop at 60% speed */}
      <video
        ref={videoRef}
        autoPlay
        loop
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
              src={getStandortLogo()}
              alt="Augen Kompetenz Zentrum Logo"
              className="w-72 h-auto object-contain"
              style={{
                mixBlendMode: 'screen',
                filter: 'drop-shadow(0 0 30px hsl(var(--brand-h) var(--brand-s) var(--brand-l) / 0.2))'
              }}
            />
          </div>
          <p className="text-white/90 text-xl font-medium tracking-widest uppercase">
            Willkommen im Augenkompetenzzentrum {getStandortName()}
          </p>
          <p className="text-white/40 text-base mt-2 tracking-wide">
            Smart Check-in für deinen Besuch
          </p>
        </header>

        {/* Hero Section */}
        <section className="text-center mb-14">
          <h1 className="text-5xl md:text-6xl font-extrabold text-white tracking-tight mb-4 leading-tight">
            Smart Check-in
          </h1>
          <p className="text-white/35 text-base tracking-wide">
            Dauert nur 60 Sekunden.
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