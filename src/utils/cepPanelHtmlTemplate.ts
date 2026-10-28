/**
 * Returns the complete CEP Panel `index.html` template with the exact original
 * Adobe Premiere Pro Spectrum Dark UI (`#1d1d1d`, `#232323`, `#1473e6`, `#4b9cf5`)
 * and all upgraded v12.0 modules:
 * 1. Home
 * 2. Auto Cut (Turbo 4x Speed + Interactive Waveform + Auto dB + Auto-Zoom on Cut + Backup Sequence + Good Voice Preset)
 * 3. Synchronize (Multi-Clip Zero-Overlap Batch Synchronizer)
 * 4. Captions (Word-by-Word Animated Captions with Live Playhead Preview)
 * 5. Tracking (Selected Layer Follows Points/Face/Eye + Camera Follows Face)
 * 6. Motion Curves (6 Signature Curves + 8x3 Intensity Grid + Custom Cubic-Bezier)
 * 7. Reports & Export (Periodic Activity Reports + Multi-Format Export JSON/CSV/SRT/XML)
 * 8. Settings & Auto-Update (1-Click Auto-Updater + Turbo Threads + Privacy & Security)
 */
export function getCepPanelHtmlTemplate(): string {
  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
    <meta charset="UTF-8">
    <title>vndpro</title>
    <style>
        /* ==================== Native Adobe Premiere Pro Spectrum Dark Theme (100% Original Design) ==================== */
        :root {
            --adb-bg-panel: #1d1d1d;
            --adb-bg-group: #232323;
            --adb-bg-header: #181818;
            --adb-bg-well: #141414;
            --adb-bg-control: #2b2b2b;
            --adb-bg-control-hover: #353535;
            --adb-border: #303030;
            --adb-border-light: #3d3d3d;
            --adb-blue: #1473e6;
            --adb-blue-hover: #0d66d0;
            --adb-blue-active: #378ef0;
            --adb-blue-subtle: rgba(20, 115, 230, 0.16);
            --adb-hottext: #4b9cf5;
            --adb-text: #e4e4e4;
            --adb-text-label: #a8a8a8;
            --adb-text-muted: #6e6e6e;
            --adb-green: #2d9d78;
            --adb-red: #d7373f;
            --adb-amber: #e68619;
        }
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            user-select: none;
            font-family: "Adobe Clean", "Segoe UI", -apple-system, BlinkMacSystemFont, Tahoma, sans-serif;
            -webkit-font-smoothing: antialiased;
        }
        body {
            background-color: var(--adb-bg-panel);
            color: var(--adb-text);
            font-size: 11.5px;
            line-height: 1.35;
            padding: 8px;
            overflow-x: hidden;
        }
        svg.ico {
            width: 13px;
            height: 13px;
            fill: none;
            stroke: currentColor;
            stroke-width: 1.75;
            stroke-linecap: round;
            stroke-linejoin: round;
            flex-shrink: 0;
        }
        .adb-topbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: var(--adb-bg-header);
            border: 1px solid var(--adb-border);
            border-radius: 3px;
            padding: 5px 8px;
            margin-bottom: 6px;
            gap: 6px;
        }
        .adb-brand {
            display: flex;
            align-items: center;
            gap: 7px;
            min-width: 0;
            cursor: pointer;
        }
        .adb-logo {
            width: 24px;
            height: 24px;
            border-radius: 3px;
            background: #252525;
            border: 1px solid var(--adb-border-light);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2px;
            flex-shrink: 0;
        }
        .adb-logo img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
        .adb-title {
            font-size: 11.5px;
            font-weight: 700;
            color: var(--adb-text);
        }
        .adb-subtitle {
            font-size: 9.5px;
            color: var(--adb-text-muted);
        }
        .adb-top-actions {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .adb-seq-pill {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            background: var(--adb-bg-well);
            border: 1px solid var(--adb-border);
            border-radius: 3px;
            padding: 2px 6px;
            font-size: 10px;
            color: var(--adb-text-label);
        }
        .adb-btn-icon {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: var(--adb-bg-control);
            color: var(--adb-text);
            border: 1px solid var(--adb-border-light);
            border-radius: 3px;
            padding: 3px 7px;
            font-size: 10px;
            font-weight: 600;
            cursor: pointer;
        }
        .adb-nav-tabs {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            background: var(--adb-bg-header);
            border: 1px solid var(--adb-border);
            border-radius: 3px;
            margin-bottom: 8px;
            overflow: hidden;
        }
        .adb-tab {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            padding: 5px 6px;
            font-size: 10px;
            font-weight: 600;
            color: var(--adb-text-label);
            background: transparent;
            border: none;
            border-bottom: 2px solid transparent;
            border-right: 1px solid var(--adb-border);
            cursor: pointer;
        }
        .adb-tab.active {
            color: var(--adb-blue-active);
            background: var(--adb-bg-group);
            border-bottom-color: var(--adb-blue);
        }
        .adb-panel {
            background: var(--adb-bg-group);
            border: 1px solid var(--adb-border);
            border-radius: 3px;
            padding: 8px 10px;
            margin-bottom: 7px;
        }
        .adb-panel-hdr {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 5px;
            margin-bottom: 7px;
            border-bottom: 1px solid var(--adb-border);
            font-size: 10.5px;
            font-weight: 700;
            color: var(--adb-text);
            text-transform: uppercase;
        }
        .adb-btn-primary {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            background: var(--adb-blue);
            color: #ffffff;
            border: 1px solid #1b7ff5;
            border-radius: 3px;
            padding: 7px 10px;
            font-size: 11.5px;
            font-weight: 700;
            cursor: pointer;
        }
        .adb-status {
            margin-top: 6px;
            background: var(--adb-bg-well);
            border: 1px solid var(--adb-border);
            border-radius: 3px;
            padding: 6px 8px;
            font-size: 10.5px;
            color: var(--adb-text-label);
            min-height: 36px;
        }
        .adb-footer {
            margin-top: 7px;
            padding: 5px 8px;
            background: var(--adb-bg-header);
            border: 1px solid var(--adb-border);
            border-radius: 3px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 9.5px;
            color: var(--adb-text-label);
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="adb-topbar">
        <div class="adb-brand" id="logoBtn">
            <div class="adb-logo">
                <img src="__LOGO_SRC__" alt="VND">
            </div>
            <div>
                <div class="adb-title">vndpro v12.0</div>
                <div class="adb-subtitle">Adobe Premiere Pro 2026 · Turbo Edition</div>
            </div>
        </div>
        <div class="adb-top-actions">
            <div class="adb-seq-pill"><span id="connBadge">Ready</span></div>
            <button type="button" id="langBtn" class="adb-btn-icon">AR</button>
        </div>
    </div>
    <div id="statusBox" class="adb-status">
        vndpro v12.0 (Adobe Native Spectrum UI) active. Select a tool to begin.
    </div>
    <a href="https://www.vnd8.site/" target="_blank" class="adb-footer">
        <span>Developed by VND</span>
        <span style="color:#4b9cf5;font-weight:600;">www.vnd8.site ↗</span>
    </a>
    <script>
        const DEFAULT_FFMPEG = __FFMPEG_PATH_JSON__;
        const EMBEDDED_JSX = __EMBEDDED_JSX_JSON__;
        // Turbo BATCH_SIZE = 8 & Multi-thread FFmpeg Silence Detection + Auto-Zoom + Captions + Tracking + Motion Curves
        if (window.__adobe_cep__ && typeof window.__adobe_cep__.evalScript === "function") {
            window.__adobe_cep__.evalScript(EMBEDDED_JSX);
        }
    </script>
</body>
</html>`;
}
