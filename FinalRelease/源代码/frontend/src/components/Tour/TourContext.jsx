import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

const TourContext = createContext();

export function useTour() {
  return useContext(TourContext);
}

export function TourProvider({ children }) {
  const [tourStep, setTourStep] = useState(() => {
    // -1 means completed, 0 means not started, > 0 means in progress
    const saved = localStorage.getItem('onboardingStep');
    if (saved === null) return 0;
    return parseInt(saved, 10);
  });
  
  const navigate = useNavigate();
  const location = useLocation();

  const updateStep = (step) => {
    setTourStep(step);
    localStorage.setItem('onboardingStep', step.toString());
  };

  const completeTour = () => {
    updateStep(-1);
  };

  const startTour = () => {
    updateStep(1);
    if (location.pathname !== '/') {
      navigate('/');
    }
  };

  const activeDriverStep = React.useRef(null);
  const driverInstance = React.useRef(null);

  // Expose a helper to run a specific driver config and hook into its lifecycle
  const runTourStep = React.useCallback((stepConfig) => {
    // Avoid running if completed or not started
    if (tourStep <= 0) return null;

    // Prevent duplicate driver instances for the same step
    if (activeDriverStep.current === tourStep && driverInstance.current) {
      return driverInstance.current;
    }

    if (driverInstance.current) {
      driverInstance.current.destroy();
    }

    activeDriverStep.current = tourStep;

    const d = driver({
      showProgress: false,
      allowClose: false, // Prevent clicking outside to close
      ...stepConfig,
      onDestroyed: (element, step, options) => {
        activeDriverStep.current = null;
        driverInstance.current = null;
        if (stepConfig.onDestroyed) {
          stepConfig.onDestroyed(element, step, options);
        }
      }
    });
    
    driverInstance.current = d;

    // Slight delay to ensure DOM is ready
    setTimeout(() => {
      if (driverInstance.current === d) {
        d.drive();
      }
    }, 300);
    
    return d;
  }, [tourStep]);

  return (
    <TourContext.Provider value={{ tourStep, updateStep, completeTour, startTour, runTourStep }}>
      {children}
    </TourContext.Provider>
  );
}
