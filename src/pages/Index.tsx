import PappadamAnalyzer from "@/components/PappadamAnalyzer";

const Index = () => {
  return (
    <main className="min-h-screen bg-background">
      <header className="container py-8">
        <h1 className="sr-only">Pappadam Bubble Analyzer – Crunch Science Edition</h1>
        <p className="text-sm text-muted-foreground">Kerala-themed, AR-powered, pseudo-scientific snack analysis.</p>
      </header>
      <section className="container pb-12">
        <PappadamAnalyzer />
      </section>
    </main>
  );
};

export default Index;
