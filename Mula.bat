@echo off
rem Starts a local web server (ES modules need http://, not file://) and opens the planner.
cd /d "%~dp0"
start "" http://localhost:8765/
python -m http.server 8765
