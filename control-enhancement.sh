#!/bin/bash

# ENHANCEMENT CONTROL SCRIPT
# Pause, resume, stop, and check status of continuous enhancement

cd "/Users/dvdbrnds/Desktop/DISASTER RECOVERY MCP ENGINE/MCP-Engine"

case "$1" in
    status)
        echo "═══════════════════════════════════════════════════════════════════"
        echo "ENHANCEMENT STATUS"
        echo "═══════════════════════════════════════════════════════════════════"
        echo ""
        
        # Check if process is running
        if [ -f continuous-enhance.pid ]; then
            PID=$(cat continuous-enhance.pid)
            if ps -p $PID > /dev/null 2>&1; then
                echo "✅ Status: RUNNING (PID: $PID)"
            else
                echo "⏸️  Status: STOPPED"
            fi
        else
            echo "⏸️  Status: NOT STARTED"
        fi
        echo ""
        
        # Count enhanced regulations
        enhanced=$(ls -1 enhanced-regulations/ 2>/dev/null | wc -l | tr -d ' ')
        total=295
        percent=$((enhanced * 100 / total))
        
        echo "📊 Progress:"
        echo "   Enhanced: $enhanced / $total ($percent%)"
        echo "   Remaining: $((total - enhanced))"
        echo ""
        
        # Show recent activity
        if [ -f logs/continuous-enhancement-full.log ]; then
            echo "Recent activity (last 5 lines):"
            tail -5 logs/continuous-enhancement-full.log
        fi
        echo ""
        echo "═══════════════════════════════════════════════════════════════════"
        ;;
        
    pause)
        echo "⏸️  Pausing enhancement process..."
        if [ -f continuous-enhance.pid ]; then
            PID=$(cat continuous-enhance.pid)
            if ps -p $PID > /dev/null 2>&1; then
                kill -STOP $PID
                echo "✅ Process paused (PID: $PID)"
                echo ""
                echo "Resume with: ./control-enhancement.sh resume"
            else
                echo "❌ Process not running"
            fi
        else
            echo "❌ No PID file found"
        fi
        ;;
        
    resume)
        echo "▶️  Resuming enhancement process..."
        if [ -f continuous-enhance.pid ]; then
            PID=$(cat continuous-enhance.pid)
            if ps -p $PID > /dev/null 2>&1; then
                kill -CONT $PID
                echo "✅ Process resumed (PID: $PID)"
                echo ""
                echo "Monitor with: ./control-enhancement.sh status"
            else
                echo "❌ Process not running"
                echo ""
                echo "Restart with: ./continuous-enhance-all.sh"
            fi
        else
            echo "❌ No PID file found"
        fi
        ;;
        
    stop)
        echo "🛑 Stopping enhancement process..."
        if [ -f continuous-enhance.pid ]; then
            PID=$(cat continuous-enhance.pid)
            if ps -p $PID > /dev/null 2>&1; then
                kill $PID
                echo "✅ Process stopped (PID: $PID)"
                rm -f continuous-enhance.pid
                echo ""
                echo "Restart with: ./continuous-enhance-all.sh"
            else
                echo "⚠️  Process already stopped"
                rm -f continuous-enhance.pid
            fi
        else
            echo "❌ No PID file found"
        fi
        ;;
        
    monitor)
        echo "📊 Monitoring enhancement progress (Ctrl+C to stop)..."
        echo ""
        tail -f logs/continuous-enhancement-full.log
        ;;
        
    restart)
        echo "🔄 Restarting enhancement process..."
        
        # Stop if running
        if [ -f continuous-enhance.pid ]; then
            PID=$(cat continuous-enhance.pid)
            if ps -p $PID > /dev/null 2>&1; then
                kill $PID
                sleep 2
            fi
            rm -f continuous-enhance.pid
        fi
        
        # Start fresh
        nohup ./continuous-enhance-all.sh > logs/continuous-enhancement-full.log 2>&1 &
        echo $! > continuous-enhance.pid
        echo "✅ Enhancement restarted (PID: $(cat continuous-enhance.pid))"
        echo ""
        echo "Monitor with: ./control-enhancement.sh status"
        ;;
        
    *)
        echo "═══════════════════════════════════════════════════════════════════"
        echo "ENHANCEMENT CONTROL"
        echo "═══════════════════════════════════════════════════════════════════"
        echo ""
        echo "Usage: ./control-enhancement.sh [command]"
        echo ""
        echo "Commands:"
        echo "  status   - Show current status and progress"
        echo "  pause    - Pause the enhancement process"
        echo "  resume   - Resume the paused process"
        echo "  stop     - Stop the enhancement process completely"
        echo "  restart  - Restart the enhancement process"
        echo "  monitor  - Watch live progress (Ctrl+C to exit)"
        echo ""
        echo "Examples:"
        echo "  ./control-enhancement.sh status"
        echo "  ./control-enhancement.sh pause"
        echo "  ./control-enhancement.sh resume"
        echo ""
        echo "═══════════════════════════════════════════════════════════════════"
        ;;
esac

