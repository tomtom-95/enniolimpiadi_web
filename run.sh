#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PIDFILE="$SCRIPT_DIR/.app.pids"

start() {
    echo -e "${GREEN}Starting application...${NC}"

    # Check if already running
    if [ -f "$PIDFILE" ]; then
        echo -e "${YELLOW}Application may already be running. Run './run.sh stop' first.${NC}"
        exit 1
    fi

    # --- Frontend Setup ---
    echo -e "${YELLOW}Setting up frontend...${NC}"
    cd "$SCRIPT_DIR"

    if [ ! -d "node_modules" ]; then
        echo "Installing frontend dependencies..."
        npm install
    else
        echo "Frontend dependencies already installed."
    fi

    # --- Backend Setup ---
    echo -e "${YELLOW}Setting up backend...${NC}"
    cd "$SCRIPT_DIR/backend"

    # Create virtual environment if it doesn't exist
    if [ ! -d ".venv" ]; then
        echo "Creating Python virtual environment..."
        python3 -m venv .venv
    fi

    # Activate virtual environment
    source .venv/bin/activate

    # Install dependencies
    echo "Installing backend dependencies..."
    pip install -r requirements.txt --quiet

    # --- Start Services ---
    echo -e "${GREEN}Starting backend server...${NC}"
    uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
    BACKEND_PID=$!

    cd "$SCRIPT_DIR"
    echo -e "${GREEN}Starting frontend server...${NC}"
    npm run dev -- --host &
    FRONTEND_PID=$!

    # Save PIDs
    echo "$BACKEND_PID $FRONTEND_PID" > "$PIDFILE"

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Application started!${NC}"
    echo -e "Frontend: ${YELLOW}http://localhost:5173${NC}"
    echo -e "Backend:  ${YELLOW}http://localhost:8000${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "Press Ctrl+C or run '${YELLOW}./run.sh stop${NC}' to stop the application."

    # Wait for both processes
    wait
}

stop() {
    echo -e "${RED}Stopping application...${NC}"

    if [ -f "$PIDFILE" ]; then
        read BACKEND_PID FRONTEND_PID < "$PIDFILE"

        # Kill backend
        if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
            echo "Stopping backend (PID: $BACKEND_PID)..."
            kill "$BACKEND_PID" 2>/dev/null
        fi

        # Kill frontend
        if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
            echo "Stopping frontend (PID: $FRONTEND_PID)..."
            kill "$FRONTEND_PID" 2>/dev/null
        fi

        rm "$PIDFILE"
        echo -e "${GREEN}Application stopped.${NC}"
    else
        echo "No PID file found. Trying to kill by port..."
        # Fallback: kill by port
        lsof -ti:8000 | xargs kill -9 2>/dev/null
        lsof -ti:5173 | xargs kill -9 2>/dev/null
        echo -e "${GREEN}Killed processes on ports 8000 and 5173.${NC}"
    fi
}

status() {
    if [ -f "$PIDFILE" ]; then
        read BACKEND_PID FRONTEND_PID < "$PIDFILE"
        echo -e "${YELLOW}Application status:${NC}"

        if kill -0 "$BACKEND_PID" 2>/dev/null; then
            echo -e "  Backend:  ${GREEN}Running${NC} (PID: $BACKEND_PID)"
        else
            echo -e "  Backend:  ${RED}Stopped${NC}"
        fi

        if kill -0 "$FRONTEND_PID" 2>/dev/null; then
            echo -e "  Frontend: ${GREEN}Running${NC} (PID: $FRONTEND_PID)"
        else
            echo -e "  Frontend: ${RED}Stopped${NC}"
        fi
    else
        echo -e "${YELLOW}Application is not running.${NC}"
    fi
}

usage() {
    echo "Usage: $0 {start|stop|restart|status}"
    echo ""
    echo "Commands:"
    echo "  start   - Install dependencies and start frontend + backend"
    echo "  stop    - Stop both frontend and backend"
    echo "  restart - Stop and start the application"
    echo "  status  - Check if the application is running"
}

# Handle Ctrl+C
trap 'stop; exit 0' SIGINT SIGTERM

case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        stop
        sleep 2
        start
        ;;
    status)
        status
        ;;
    *)
        usage
        exit 1
        ;;
esac
