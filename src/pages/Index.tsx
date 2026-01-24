import akzLogo from "@/assets/akz-logo.png";
import CheckInForm from "@/components/CheckInForm";

const Index = () => {
  // Optional: Set your webhook URL here
  const webhookUrl = "";

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Aurora Background */}
      <div className="aurora-animated" />
      
      <div className="relative z-10 container max-w-md mx-auto px-6 py-10 pb-16">
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
                filter: 'drop-shadow(0 0 40px rgba(57, 224, 120, 0.15))'
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
        <CheckInForm webhookUrl={webhookUrl} />
        
        {/* Footer Spacer */}
        <div className="h-12" />
      </div>
    </div>
  );
};

export default Index;
