import auroraLogo from "@/assets/aurora-logo.jpg";
import CheckInForm from "@/components/CheckInForm";

const Index = () => {
  // Optional: Set your webhook URL here
  const webhookUrl = "";

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Ambient Background Glow */}
      <div className="ambient-glow" />
      
      <div className="relative z-10 container max-w-md mx-auto px-6 py-10 pb-16">
        {/* Header with Logo Glow */}
        <header className="text-center mb-16 relative">
          {/* Logo Glow Effect */}
          <div className="logo-glow" />
          
          <div className="relative z-10 flex justify-center mb-8">
            <img 
              src={auroraLogo} 
              alt="AURORA Logo" 
              className="w-52 h-52 object-contain"
              style={{
                filter: 'drop-shadow(0 0 40px rgba(57, 224, 120, 0.2))'
              }}
            />
          </div>
          <p className="text-white/90 text-lg font-light tracking-widest uppercase">
            Willkommen bei AURORA
          </p>
          <p className="text-white/40 text-sm mt-2 tracking-wide">
            Dein Augenkompetenzzentrum
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
        <CheckInForm webhookUrl={webhookUrl} />
        
        {/* Footer Spacer */}
        <div className="h-12" />
      </div>
    </div>
  );
};

export default Index;
