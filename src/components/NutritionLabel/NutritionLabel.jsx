import React, { useEffect, useRef } from 'react';
import VanillaTilt from 'vanilla-tilt';
import './NutritionLabel.css';

export function NutritionLabel({ data }) {
  const tiltRef = useRef(null);

  useEffect(() => {
    if (tiltRef.current) {
      VanillaTilt.init(tiltRef.current, {
        max: 15,
        speed: 400,
        glare: true,
        'max-glare': 0.5,
      });
    }
    return () => {
      if (tiltRef.current?.vanillaTilt) {
        tiltRef.current.vanillaTilt.destroy();
      }
    };
  }, []);

  return (
    <div className="nutrition-wrapper" ref={tiltRef}>
      <div className="nutrition-label">
        <header className="nutrition-header">
          <h1>Nutrition Facts</h1>
          <p className="subtitle">数字营养成分表</p>
        </header>
        <div className="nutrition-divider thick"></div>
        <div className="nutrition-serving">
          <p>Serving Size: 1 week (7 days)</p>
          <p>Amount per serving</p>
        </div>
        <div className="nutrition-divider solid"></div>
        <div className="nutrition-calories">
          <h2>Time Value</h2>
          <span>High</span>
        </div>
        <div className="nutrition-divider medium"></div>
        <div className="nutrition-daily-value">
          <p className="right-align">% Daily Value*</p>
          {data.map((item, index) => (
            <div key={index} className="nutrition-row">
              <div className="nutrition-row-title">
                <span className="bullet" style={{ backgroundColor: item.color }}></span>
                <strong>{item.name}</strong>
              </div>
              <span className="nutrition-row-value">{item.value}%</span>
            </div>
          ))}
        </div>
        <div className="nutrition-divider thick"></div>
        <footer className="nutrition-footer">
          <p>* The % Daily Value (DV) tells you how much a nutrient in a serving of food contributes to a daily diet.</p>
        </footer>
      </div>
    </div>
  );
}
