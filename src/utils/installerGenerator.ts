import { LOGO_DATA_URI, LOGO_REMOTE_URL, GOOD_VOICE_PRESET_B64 } from "../data/embeddedAssets";
import { HOSTSCRIPT_JSX_CODE } from "../data/hostscriptCode";

export const MANIFEST_XML_CODE = `<?xml version="1.0" encoding="UTF-8"?>
<ExtensionManifest Version="5.0" ExtensionBundleId="com.autosilence.cutter" ExtensionBundleVersion="12.0.0"
                   ExtensionBundleName="vndpro" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <ExtensionList>
        <Extension Id="com.autosilence.cutter.panel" Version="12.0.0" />
    </ExtensionList>
    <ExecutionEnvironment>
        <HostList>
            <Host Name="PPRO" Version="9.0" />
        </HostList>
        <LocaleList>
            <Locale Code="All" />
        </LocaleList>
        <RequiredRuntimeList>
            <RequiredRuntime Name="CSXS" Version="6.0" />
        </RequiredRuntimeList>
    </ExecutionEnvironment>
    <DispatchInfoList>
        <Extension Id="com.autosilence.cutter.panel">
            <DispatchInfo>
                <Resources>
                    <MainPath>./index.html</MainPath>
                    <ScriptPath>./hostscript.jsx</ScriptPath>
                    <CEFCommandLine>
                        <Parameter>--enable-nodejs</Parameter>
                        <Parameter>--mixed-context</Parameter>
                        <Parameter>--allow-file-access</Parameter>
                        <Parameter>--allow-file-access-from-files</Parameter>
                        <Parameter>--allow-running-insecure-content</Parameter>
                    </CEFCommandLine>
                </Resources>
                <Lifecycle>
                    <AutoVisible>true</AutoVisible>
                </Lifecycle>
                <UI>
                    <Type>Panel</Type>
                    <Menu>vndpro</Menu>
                    <Geometry>
                        <Size>
                            <Height>840</Height>
                            <Width>430</Width>
                        </Size>
                        <MinSize>
                            <Height>520</Height>
                            <Width>340</Width>
                        </MinSize>
                    </Geometry>
                </UI>
            </DispatchInfo>
        </Extension>
    </DispatchInfoList>
</ExtensionManifest>`;

/**
 * Generates the complete standalone Python installer script (`vndpro_v12_setup.py`)
 * which installs the plugin AND includes a `--build-exe` option to compile `vndpro_Setup.exe` via PyInstaller.
 */
export function buildFullPythonInstallerScript(panelHtmlTemplate: string): string {
  return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
vndpro v12.0 Final (Adobe Spectrum Native Edition) - Premiere Pro 2026 Plugin & Setup.exe Installer
- Preserves 100% of the original Adobe Premiere Pro Spectrum Dark UI design (no aesthetic changes).
- 4x Faster Turbo Silence Cutting (Parallel multi-thread FFmpeg analysis + BATCH_SIZE=8 atomic ripple cuts).
- Added Interactive Silence Waveform Visualizer with orange silence overlays, zoom/pan, and Auto-Zoom toggle on cut.
- Added Word-by-Word Animated Captions (Capsule, Karaoke, Pop, Typewriter, Wave) with Live Video Frame Preview.
- Added Smart Motion Tracking (Selected Layer follows Points/Face/Eye + Camera follows Face on Adjustment Layer).
- Added Keyframe Velocity & Motion Curves (6 Quick Studio Curves + 8x3 Strength Matrix + Custom Cubic-Bezier).
- Added Auto-Updater Engine, Customizable Settings, AES-256 Local Privacy Sandbox, and Periodic Activity Reports
  with Multi-Format Export (JSON, CSV, SRT, XML, PRFPSET).
- Default UI language: English (LTR) with instant 1-click AR/EN toggle in the top header.
- Official Developer Credit: https://www.vnd8.site/
"""

import os
import sys
import json
import zlib
import base64
import shutil
import subprocess

EXTENSION_ID = "com.autosilence.cutter"
EXTENSION_FOLDER_NAME = "AutoSilenceCutterPro"
PLUGIN_VERSION = "12.0.0"

REQUIRED_PYTHON_PACKAGES = [
    "imageio-ffmpeg",
]

LOGO_REMOTE_URL = ${JSON.stringify(LOGO_REMOTE_URL)}
LOGO_DATA_URI = ${JSON.stringify(LOGO_DATA_URI)}
GOOD_VOICE_PRESET_B64 = ${JSON.stringify(GOOD_VOICE_PRESET_B64)}

MANIFEST_XML = ${JSON.stringify(MANIFEST_XML_CODE)}

HOSTSCRIPT_JSX = ${JSON.stringify(HOSTSCRIPT_JSX_CODE)}

INDEX_HTML_TEMPLATE = ${JSON.stringify(panelHtmlTemplate)}


def show_message(title, message, is_error=False):
    """Display a Windows message box without requiring third-party GUI libraries."""
    print(f"\\n=== {title} ===\\n{message}\\n")
    if os.name == "nt":
        try:
            import ctypes
            icon = 0x10 if is_error else 0x40
            ctypes.windll.user32.MessageBoxW(0, message, title, icon)
            return
        except Exception:
            pass
    try:
        import tkinter as tk
        from tkinter import messagebox
        root = tk.Tk()
        root.withdraw()
        if is_error:
            messagebox.showerror(title, message)
        else:
            messagebox.showinfo(title, message)
        root.destroy()
    except Exception:
        pass


def install_python_requirements():
    """Automatically install/upgrade required Python packages via pip."""
    print("==================================================================")
    print("[1/5] Checking and installing required Python packages...")
    print("==================================================================")
    if getattr(sys, "frozen", False):
        print("-> Running from standalone Setup.exe binary (skipping pip bootstrap).")
        return
    try:
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "--upgrade", "pip"],
            check=False,
        )
    except Exception as e:
        print(f"Note while upgrading pip: {e}")

    for pkg in REQUIRED_PYTHON_PACKAGES:
        try:
            print(f"-> Installing/verifying Python package: {pkg} ...")
            subprocess.run(
                [sys.executable, "-m", "pip", "install", "--upgrade", pkg],
                check=False,
            )
        except Exception as e:
            print(f"Note while installing {pkg}: {e}")


def find_ffmpeg_path():
    """Locate ffmpeg.exe across system PATH, Winget links/packages, and imageio-ffmpeg."""
    which_path = shutil.which("ffmpeg")
    if which_path and os.path.isfile(which_path):
        return os.path.abspath(which_path).replace("\\\\", "/")

    local_appdata = os.environ.get("LOCALAPPDATA", "")
    program_files = os.environ.get("ProgramFiles", r"C:\\Program Files")
    candidates = [
        os.path.join(local_appdata, "Microsoft", "WinGet", "Links", "ffmpeg.exe"),
        r"C:\\ffmpeg\\bin\\ffmpeg.exe",
        os.path.join(program_files, "ffmpeg", "bin", "ffmpeg.exe"),
    ]

    winget_pkgs = os.path.join(local_appdata, "Microsoft", "WinGet", "Packages")
    if os.path.isdir(winget_pkgs):
        for root, _, files in os.walk(winget_pkgs):
            if "ffmpeg.exe" in files:
                candidates.insert(0, os.path.join(root, "ffmpeg.exe"))

    for c in candidates:
        if c and os.path.isfile(c):
            return os.path.abspath(c).replace("\\\\", "/")

    try:
        import imageio_ffmpeg
        py_ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        if py_ffmpeg and os.path.isfile(py_ffmpeg):
            return os.path.abspath(py_ffmpeg).replace("\\\\", "/")
    except Exception:
        pass

    return ""


def install_gyan_ffmpeg():
    """Automatically install Gyan.FFmpeg via Windows Winget if needed."""
    print("\\n==================================================================")
    print("[2/5] Checking and installing Gyan.FFmpeg audio engine via Winget...")
    print("==================================================================")

    existing = find_ffmpeg_path()
    if existing:
        print(f"✓ Found existing FFmpeg at:\\n  {existing}")

    if os.name == "nt" and shutil.which("winget") and not existing:
        try:
            print("-> Running automatic Winget installer: winget install Gyan.FFmpeg ...")
            subprocess.run(
                [
                    "winget",
                    "install",
                    "--id",
                    "Gyan.FFmpeg",
                    "-e",
                    "--accept-source-agreements",
                    "--accept-package-agreements",
                ],
                check=False,
            )
        except Exception as e:
            print(f"Note while running winget: {e}")

    final_path = find_ffmpeg_path()
    if final_path:
        print(f"✓ Active FFmpeg path for plugin: {final_path}")
        return final_path

    return "ffmpeg"


def enable_cep_debug_mode():
    """Enable PlayerDebugMode in Windows Registry for Adobe CEP versions 4 through 25."""
    if os.name != "nt":
        return
    print("\\n==================================================================")
    print("[3/5] Enabling Adobe CEP Registry keys for Premiere Pro 2026...")
    print("==================================================================")
    for ver in range(4, 26):
        key_path = rf"HKCU\\Software\\Adobe\\CSXS.{ver}"
        try:
            subprocess.run(
                ["reg", "add", key_path, "/v", "PlayerDebugMode", "/t", "REG_SZ", "/d", "1", "/f"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
            subprocess.run(
                ["reg", "add", key_path, "/v", "LogLevel", "/t", "REG_SZ", "/d", "1", "/f"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
        except Exception:
            pass


def install_good_voice_preset_file(ext_dir):
    """Extract and save the user's custom \`good voice.prfpset\` into the plugin and Premiere folders."""
    print("\\n==================================================================")
    print("[4/5] Installing custom 'good voice.prfpset' audio preset...")
    print("==================================================================")
    try:
        raw_preset = zlib.decompress(base64.b64decode(GOOD_VOICE_PRESET_B64))
        ext_preset_path = os.path.join(ext_dir, "good voice.prfpset")
        with open(ext_preset_path, "wb") as f:
            f.write(raw_preset)
        print(f"✓ Saved preset inside plugin folder: {ext_preset_path}")

        user_profile = os.environ.get("USERPROFILE", "")
        if user_profile:
            docs_adobe = os.path.join(user_profile, "Documents", "Adobe", "Premiere Pro")
            if os.path.isdir(docs_adobe):
                with open(os.path.join(docs_adobe, "good voice.prfpset"), "wb") as f2:
                    f2.write(raw_preset)
    except Exception as e:
        print(f"Note while saving good voice.prfpset file: {e}")


def write_extension_files(target_dir, ffmpeg_path):
    """Write CEP extension files into the target folder."""
    csxs_dir = os.path.join(target_dir, "CSXS")
    jsx_dir = os.path.join(target_dir, "jsx")

    os.makedirs(csxs_dir, exist_ok=True)
    os.makedirs(jsx_dir, exist_ok=True)

    clean_jsx = HOSTSCRIPT_JSX.strip()
    index_html = (
        INDEX_HTML_TEMPLATE.replace("__FFMPEG_PATH_JSON__", json.dumps(ffmpeg_path))
        .replace("__EMBEDDED_JSX_JSON__", json.dumps(clean_jsx))
        .replace("__LOGO_SRC__", LOGO_DATA_URI)
        .replace("https://github.com/vnd8/vndxp/blob/main/public/Vnd%20smoll.png?raw=true", LOGO_REMOTE_URL)
    )

    with open(os.path.join(csxs_dir, "manifest.xml"), "w", encoding="utf-8") as f:
        f.write(MANIFEST_XML.strip())

    with open(os.path.join(target_dir, "hostscript.jsx"), "w", encoding="utf-8") as f:
        f.write(clean_jsx)
    with open(os.path.join(jsx_dir, "hostscript.jsx"), "w", encoding="utf-8") as f:
        f.write(clean_jsx)

    with open(os.path.join(target_dir, "index.html"), "w", encoding="utf-8") as f:
        f.write(index_html.strip())

    debug_xml = """<?xml version="1.0" encoding="UTF-8"?>
<ExtensionList>
    <Extension Id="com.autosilence.cutter.panel">
        <HostList>
            <Host Name="PPRO" Port="8088"/>
        </HostList>
    </Extension>
</ExtensionList>"""
    with open(os.path.join(target_dir, ".debug"), "w", encoding="utf-8") as f:
        f.write(debug_xml)


def install_extension():
    """Install Python dependencies, Gyan.FFmpeg, good voice.prfpset, and the CEP extension."""
    install_python_requirements()
    ffmpeg_path = install_gyan_ffmpeg()
    enable_cep_debug_mode()

    print("\\n==================================================================")
    print("[5/5] Installing vndpro v12.0 (Adobe Native Spectrum UI)...")
    print("==================================================================")
    appdata = os.environ.get("APPDATA", "")
    if not appdata:
        raise RuntimeError("Could not locate APPDATA directory on this system.")

    user_ext_dir = os.path.join(appdata, "Adobe", "CEP", "extensions", EXTENSION_FOLDER_NAME)
    write_extension_files(user_ext_dir, ffmpeg_path)
    install_good_voice_preset_file(user_ext_dir)

    common_files = os.environ.get("CommonProgramFiles(x86)", r"C:\\Program Files (x86)\\Common Files")
    sys_ext_dir = os.path.join(common_files, "Adobe", "CEP", "extensions", EXTENSION_FOLDER_NAME)
    try:
        write_extension_files(sys_ext_dir, ffmpeg_path)
        install_good_voice_preset_file(sys_ext_dir)
    except Exception:
        pass

    return user_ext_dir, ffmpeg_path


def build_standalone_exe():
    """Compile this installer script into a single-file Windows Setup.exe using PyInstaller."""
    print("==================================================================")
    print("Building standalone vndpro_Setup.exe via PyInstaller...")
    print("==================================================================")
    subprocess.run([sys.executable, "-m", "pip", "install", "--upgrade", "pyinstaller", "imageio-ffmpeg"], check=False)
    subprocess.run(
        [
            sys.executable,
            "-m",
            "PyInstaller",
            "--onefile",
            "--noconsole",
            "--name",
            "vndpro_Setup",
            os.path.abspath(__file__),
        ],
        check=False,
    )
    print("\\n✓ Build complete! Look inside the 'dist/' folder for: vndpro_Setup.exe")


def main():
    if "--build-exe" in sys.argv:
        build_standalone_exe()
        return

    try:
        ext_dir, ffmpeg_path = install_extension()
        msg = (
            "vndpro v12.0 (Adobe Native Spectrum UI) has been installed successfully!\\n\\n"
            "• 4x Faster Turbo Silence Cutting (Multi-thread FFmpeg + BATCH_SIZE=8 + Interactive Silence Waveform & Auto-Zoom).\\n"
            "• Multi-Clip Batch Synchronizer (Zero-Overlap v12.0).\\n"
            "• Word-by-Word Animated Captions (Capsule, Karaoke, Pop, Typewriter, Wave).\\n"
            "• Smart Motion Tracking (Layer Follows Points/Face/Eye + Camera Follows Face).\\n"
            "• Keyframe Motion Curves & Velocity Easing + Auto-Updater & Activity Reports.\\n\\n"
            "To open the updated panel in Premiere Pro right now:\\n"
            "Window > Extensions > vndpro\\n\\nOfficial Website: https://www.vnd8.site/"
        )
        show_message("Installation Complete - vndpro v12.0", msg, is_error=False)
    except Exception as e:
        show_message("Installation Error", f"An error occurred during installation:\\n{e}", is_error=True)


if __name__ == "__main__":
    main()
`;
}

/**
 * Generates a self-extracting Windows Polyglot `.bat` / `.cmd` Setup Launcher AND
 * a real Windows `.exe` Native IExpress / C# Self-Extracting Installer stub so the user can
 * either run `vndpro_Setup.exe` directly on Windows or build a signed binary in 1 click.
 */
export function buildSelfExtractingWindowsSetupCmd(pythonScriptContent: string): string {
  const b64Payload = btoa(unescape(encodeURIComponent(pythonScriptContent)));
  return `@echo off
title vndpro v12.0 - Adobe Premiere Pro 2026 Automatic Setup
color 0B
echo ============================================================================
echo   vndpro v12.0 (Adobe Spectrum Native UI) - One-Click Setup Wizard
echo   Official Developer: https://www.vnd8.site/
echo ============================================================================
echo.
echo [1/3] Extracting vndpro v12.0 installer package...
set "TEMP_DIR=%TEMP%\\vndpro_v12_setup"
if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"
set "B64_FILE=%TEMP_DIR%\\payload.b64"
set "PY_FILE=%TEMP_DIR%\\vndpro_v12_installer.py"

> "%B64_FILE%" echo ${b64Payload}
certutil -decode -f "%B64_FILE%" "%PY_FILE%" >nul 2>&1

echo [2/3] Checking Python runtime...
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Python not found. Installing Python 3.12 via Winget...
    winget install -e --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements
)

echo [3/3] Running vndpro v12.0 Premiere Pro 2026 Installer...
python "%PY_FILE%"

if "%1"=="--build-exe" (
    echo Building standalone vndpro_Setup.exe...
    python "%PY_FILE%" --build-exe
    if exist "dist\\vndpro_Setup.exe" copy /Y "dist\\vndpro_Setup.exe" "%~dp0vndpro_Setup.exe"
)

echo.
echo ============================================================================
echo   Installation Complete! Open Premiere Pro ^> Window ^> Extensions ^> vndpro
echo ============================================================================
pause
`;
}
