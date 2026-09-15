@echo off
rem Gorev Zamanlayici tarafindan cagrilir: depo kokune gecer, keşfi calistirir, ciktiyi data\discover.log'a ekler.
cd /d "%~dp0.."
if not exist "data" mkdir "data"
echo ==== %date% %time% ==== >> "data\discover.log"
call npm run discover >> "data\discover.log" 2>&1
