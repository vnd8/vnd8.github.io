import React, { useState, useEffect } from "react";
import Portfolio from "./components/Portfolio";
import AdminDashboard from "./components/AdminDashboard";

export default function App() {
  // Support both Arabic and English. Default to Arabic (RTL) for best personal touch!
  const [currentLang, setCurrentLang] = useState<"en" | "ar">("ar");
  const [currentView, setCurrentView] = useState<"portfolio" | "admin">("portfolio");

  // Route listening
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === "#admin") {
        setCurrentView("admin");
      } else {
        setCurrentView("portfolio");
      }
    };

    // Run on initial mount
    handleHashChange();

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const toggleLang = () => {
    setCurrentLang((prev) => (prev === "en" ? "ar" : "en"));
  };

  const handleNavigateToAdmin = () => {
    window.location.hash = "#admin";
  };

  const handleBackToPortfolio = () => {
    window.location.hash = "";
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-blue-500 selection:text-white">
      {currentView === "portfolio" ? (
        <Portfolio 
          currentLang={currentLang} 
          toggleLang={toggleLang} 
          onNavigateToAdmin={handleNavigateToAdmin} 
        />
      ) : (
        <AdminDashboard 
          currentLang={currentLang} 
          toggleLang={toggleLang} 
          onBackToPortfolio={handleBackToPortfolio} 
        />
      )}
    </div>
  );
}
