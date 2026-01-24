import auroraLogo from "@/assets/aurora-logo.jpg";
import CheckInForm from "@/components/CheckInForm";

const Index = () => {
  // Optional: Set your webhook URL here
  const webhookUrl = "";

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Aurora Glow Background Effect */}
      <div className="aurora-glow-bg" />
      
      <div className="relative z-10 container max-w-md mx-auto px-6 py-8 pb-12">
        {/* Header */}
        <header className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <img 
              src={auroraLogo} 
              alt="AURORA Logo" 
              className="w-40 h-40 object-contain"
            />
          </div>
          <p className="text-foreground/90 text-base font-light tracking-wide">
            Willkommen bei AURORA.
          </p>
          <p className="text-muted-foreground text-sm mt-1">
            Dein Augenkompetenzzentrum.
          </p>
        </header>

        {/* Hero Section */}
        <section className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-foreground tracking-tight mb-2">
            Smart Check-in
          </h1>
          <p className="text-muted-foreground text-sm">
            Dauert nur 30 Sekunden.
          </p>
        </section>

        {/* Form */}
        <CheckInForm webhookUrl={webhookUrl} />
        
        {/* Footer Spacer */}
        <div className="h-8" />
      </div>
    </div>
  );
};

export default Index;
