import React from 'react';
import { Type, Check, Eye, HelpCircle } from 'lucide-react';

const FOCUS_COLORS = [
  { name: "Neon Yellow", value: "#eab308" },
  { name: "Emerald Green", value: "#22c55e" },
  { name: "Electric Cyan", value: "#06b6d4" },
  { name: "Hot Pink", value: "#ec4899" }
];

const TEXT_COLORS = [
  { name: "White", value: "#ffffff" },
  { name: "Cream Yellow", value: "#fef08a" },
  { name: "Soft Cyan", value: "#e0f2fe" },
  { name: "Mint Green", value: "#f0fdf4" }
];

const STROKE_COLORS = [
  { name: "Black Outline", value: "#000000" },
  { name: "Dark Slate", value: "#1e293b" },
  { name: "Indigo Border", value: "#312e81" },
  { name: "No Outline", value: "none" }
];

export default function SubtitleEditor({
  subtitleSettings = { 
    focusColor: '#eab308', 
    textColor: '#ffffff',
    pulseHighlight: true,
    fontFamily: 'Outfit',
    fontSize: 26,
    textCase: 'uppercase',
    strokeColor: '#000000',
    strokeWidth: 4,
    animationStyle: 'pulse',
    bgBoxColor: 'rgba(0, 0, 0, 0.75)',
    verticalPos: 0.68
  },
  setSubtitleSettings = () => {},
  showSafeZone = false,
  setShowSafeZone = () => {},
  videoProfile = 'faceless'
}) {

  const updateSetting = (key, value) => {
    setSubtitleSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <div className="glass-panel flex-col gap-5 w-full">
      <div>
        <h3 className="flex-row-center text-slate-200" style={{ fontSize: '15px', fontWeight: '700' }}>
          <Type size={18} style={{ color: 'var(--color-primary)' }} /> Karaoke Subtitle Engine
        </h3>
        <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>Customize font highlighting, styling, and safe-zone guides</p>
      </div>

      <div className="flex-col gap-4" style={{ maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
        
        {/* Font Family Selector */}
        <div className="form-group">
          <label className="input-label" style={{ fontSize: '10px' }}>Font Family</label>
          <select
            value={subtitleSettings.fontFamily || 'Outfit'}
            onChange={(e) => updateSetting('fontFamily', e.target.value)}
            className="select-input"
            style={{ padding: '8px 12px', fontSize: '12.5px' }}
          >
            <option value="Outfit">Outfit (Rounded Display)</option>
            <option value="Inter">Inter (Sleek Sans-Serif)</option>
            <option value="Montserrat">Montserrat (Modern Bold)</option>
            <option value="Poppins">Poppins (Geometric Display)</option>
            <option value="Impact">Impact (Classic Meme Style)</option>
          </select>
        </div>

        {/* Font Size Slider */}
        <div className="form-group">
          <div className="flex-row items-center justify-between">
            <label className="input-label" style={{ fontSize: '10px' }}>Font Size ({subtitleSettings.fontSize || 26}px)</label>
          </div>
          <input
            type="range"
            min="18"
            max="48"
            step="1"
            value={subtitleSettings.fontSize || 26}
            onChange={(e) => updateSetting('fontSize', parseInt(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
          />
        </div>

        {/* Subtitle Alignment / Y Position */}
        <div className="form-group">
          <div className="flex-row items-center justify-between">
            <label className="input-label" style={{ fontSize: '10px' }}>Vertical Position ({Math.round((subtitleSettings.verticalPos || 0.68) * 100)}%)</label>
          </div>
          <input
            type="range"
            min="0.50"
            max="0.85"
            step="0.01"
            value={subtitleSettings.verticalPos || 0.68}
            onChange={(e) => updateSetting('verticalPos', parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
          />
        </div>

        {/* Highlight Style & Animation Selection */}
        <div className="form-group">
          <label className="input-label" style={{ fontSize: '10px' }}>Highlight Style</label>
          <select
            value={subtitleSettings.animationStyle || 'pulse'}
            onChange={(e) => updateSetting('animationStyle', e.target.value)}
            className="select-input"
            style={{ padding: '8px 12px', fontSize: '12.5px' }}
          >
            <option value="pulse">Pulse pop (Active word scaled 1.15x)</option>
            <option value="color">Static Color Focus (Change color only)</option>
            <option value="bg-box">Instagram Box (Dark background behind active word)</option>
            <option value="bounce-pop">Dynamic Bounce (Bounce up & tilt active word)</option>
          </select>
        </div>

        {/* Subtitle Case Selection */}
        <div className="form-group">
          <label className="input-label" style={{ fontSize: '10px' }}>Text Capitalization</label>
          <select
            value={subtitleSettings.textCase || 'uppercase'}
            onChange={(e) => updateSetting('textCase', e.target.value)}
            className="select-input"
            style={{ padding: '8px 12px', fontSize: '12.5px' }}
          >
            <option value="uppercase">ALL UPPERCASE (Recommended)</option>
            <option value="normal">Standard / Sentence Case</option>
          </select>
        </div>

        {/* Text Colors Swatches */}
        <div className="flex-col gap-2">
          <label className="input-label" style={{ fontSize: '10px' }}>Inactive Word Color</label>
          <div className="swatches-container">
            {TEXT_COLORS.map((color) => {
              const isSelected = subtitleSettings.textColor === color.value;
              return (
                <button
                  key={color.value}
                  onClick={() => updateSetting('textColor', color.value)}
                  className={`swatch-btn ${isSelected ? 'active' : ''}`}
                  style={{ backgroundColor: color.value, border: '1px solid rgba(255,255,255,0.1)' }}
                  title={color.name}
                >
                  {isSelected && <Check size={14} style={{ color: '#000' }} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Focus Color Selector */}
        <div className="flex-col gap-2">
          <label className="input-label" style={{ fontSize: '10px' }}>Active Word Focus Color</label>
          <div className="swatches-container">
            {FOCUS_COLORS.map((color) => {
              const isSelected = subtitleSettings.focusColor === color.value;
              return (
                <button
                  key={color.value}
                  onClick={() => updateSetting('focusColor', color.value)}
                  className={`swatch-btn ${isSelected ? 'active' : ''}`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                >
                  {isSelected && <Check size={14} style={{ color: 'var(--bg-darker)' }} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Outline Stroke Color Selector */}
        <div className="flex-col gap-2">
          <label className="input-label" style={{ fontSize: '10px' }}>Text Outline/Stroke Color</label>
          <div className="swatches-container">
            {STROKE_COLORS.map((color) => {
              const isSelected = subtitleSettings.strokeColor === color.value;
              return (
                <button
                  key={color.value}
                  onClick={() => updateSetting('strokeColor', color.value)}
                  className={`swatch-btn ${isSelected ? 'active' : ''}`}
                  style={{ 
                    backgroundColor: color.value === 'none' ? '#1e293b' : color.value,
                    border: '1.5px solid rgba(255,255,255,0.15)',
                    position: 'relative'
                  }}
                  title={color.name}
                >
                  {color.value === 'none' && <span style={{ fontSize: '8px', color: '#94a3b8', fontWeight: 'bold' }}>N/A</span>}
                  {isSelected && <Check size={14} style={{ color: color.value === '#ffffff' ? '#000000' : '#ffffff' }} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Outline Stroke Width Slider */}
        {subtitleSettings.strokeColor !== 'none' && (
          <div className="form-group">
            <div className="flex-row items-center justify-between">
              <label className="input-label" style={{ fontSize: '10px' }}>Text Outline Width ({subtitleSettings.strokeWidth || 4}px)</label>
            </div>
            <input
              type="range"
              min="0"
              max="8"
              step="1"
              value={subtitleSettings.strokeWidth !== undefined ? subtitleSettings.strokeWidth : 4}
              onChange={(e) => updateSetting('strokeWidth', parseInt(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
            />
          </div>
        )}

        {/* Safe-Zone Overlays controls */}
        <div className="settings-row-item" style={{ marginTop: '8px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex-col" style={{ gap: '2px' }}>
            <span className="text-xs font-semibold text-slate-300">Visual Layout Safe-Zones</span>
            <span className="text-[10px] text-slate-500">Show lines for 80% width and 15% / 25% height borders</span>
          </div>
          <button
            onClick={() => setShowSafeZone(!showSafeZone)}
            className={`glow-btn ${showSafeZone ? '' : 'glow-btn-secondary'}`}
            style={{ 
              padding: '6px 12px', 
              fontSize: '11px',
              background: showSafeZone ? 'linear-gradient(135deg, var(--color-emerald), var(--color-accent))' : undefined,
              boxShadow: showSafeZone ? '0 4px 12px rgba(16, 185, 129, 0.25)' : undefined
            }}
          >
            <Eye size={12} style={{ marginRight: '4px' }} /> {showSafeZone ? "Disable Guide" : "Show Guide"}
          </button>
        </div>

        {/* Safe Zone compliance notes */}
        <div className="alert-box" style={{ padding: '12px', marginTop: '4px' }}>
          <HelpCircle size={14} style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: '2px' }} />
          <div className="flex-col" style={{ gap: '4px' }}>
            <span className="input-label" style={{ fontSize: '9px', color: '#a5b4fc' }}>Layout Constraint Compliance:</span>
            <div style={{ fontSize: '10px', color: '#cbd5e1', lineHeight: '1.4' }}>
              {videoProfile === 'split-screen' && (
                <span>Dialogue split divides at exact center (y = 50%). Subtitles avoid margins. Non-speaking avatar blinks/breathes automatically.</span>
              )}
              {videoProfile === 'faceless' && (
                <span>Atmospheric B-Roll loops continuously. Zoom factors scale up to 1.05x. Subtitle text center-aligns with contrast drop shadow.</span>
              )}
              {videoProfile === 'guru' && (
                <span>Solo Guru talking head cropped from chest up. Camera dynamically cuts zoom from 1.0x to close-up 1.15x at sentence transitions.</span>
              )}
              {videoProfile === 'tweet-showcase' && (
                <span>Social card details conform to 20px rounded card corners. Enters stage using a 500ms sliding layout transitions.</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
