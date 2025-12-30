#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Hardcoded ports
BACKEND_PORT=8001
FRONTEND_PORT=5173

wait_for_port_free() {
    local port=$1
    local max_attempts=10
    local attempt=0

    while lsof -ti:$port > /dev/null 2>&1; do
        attempt=$((attempt + 1))
        if [ $attempt -ge $max_attempts ]; then
            echo -e "${RED}Warning: Port $port still in use after ${max_attempts} attempts${NC}"
            return 1
        fi
        sleep 0.5
    done
    return 0
}

stop() {
    echo -e "${RED}Stopping application...${NC}"

    # Delete database file
    if [ -f "$SCRIPT_DIR/backend/olympiad.db" ]; then
        echo "Deleting database file..."
        rm "$SCRIPT_DIR/backend/olympiad.db"
    fi

    # Kill processes on backend port
    if lsof -ti:$BACKEND_PORT > /dev/null 2>&1; then
        echo "Stopping backend (port $BACKEND_PORT)..."
        lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null
        wait_for_port_free $BACKEND_PORT
    fi

    # Kill processes on frontend port
    if lsof -ti:$FRONTEND_PORT > /dev/null 2>&1; then
        echo "Stopping frontend (port $FRONTEND_PORT)..."
        lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null
        wait_for_port_free $FRONTEND_PORT
    fi

    echo -e "${GREEN}Application stopped.${NC}"
}

start() {
    echo -e "${GREEN}Starting application...${NC}"

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

    # Create virtual environment in root if it doesn't exist
    if [ ! -d "$SCRIPT_DIR/venv" ]; then
        echo "Creating Python virtual environment..."
        python3 -m venv "$SCRIPT_DIR/venv"
    fi

    # Activate virtual environment
    source "$SCRIPT_DIR/venv/bin/activate"

    # Install dependencies
    echo "Installing backend dependencies..."
    pip install -r "$SCRIPT_DIR/backend/requirements.txt" -q

    # --- Start Services ---
    echo -e "${GREEN}Starting backend server...${NC}"
    cd "$SCRIPT_DIR/backend"
    uvicorn main:app --reload --host 0.0.0.0 --port $BACKEND_PORT &

    cd "$SCRIPT_DIR"
    echo -e "${GREEN}Starting frontend server...${NC}"
    npm run dev -- --host &

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Application started!${NC}"
    echo -e "Frontend: ${YELLOW}http://localhost:$FRONTEND_PORT${NC}"
    echo -e "Backend:  ${YELLOW}http://localhost:$BACKEND_PORT${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "Press Ctrl+C or run '${YELLOW}./run.sh stop${NC}' to stop the application."

    # Wait for both processes
    wait
}

status() {
    echo -e "${YELLOW}Application status:${NC}"

    if lsof -ti:$BACKEND_PORT > /dev/null 2>&1; then
        echo -e "  Backend (port $BACKEND_PORT):  ${GREEN}Running${NC}"
    else
        echo -e "  Backend (port $BACKEND_PORT):  ${RED}Stopped${NC}"
    fi

    if lsof -ti:$FRONTEND_PORT > /dev/null 2>&1; then
        echo -e "  Frontend (port $FRONTEND_PORT): ${GREEN}Running${NC}"
    else
        echo -e "  Frontend (port $FRONTEND_PORT): ${RED}Stopped${NC}"
    fi
}

usage() {
    echo "Usage: $0 {start|stop|restart|status}"
    echo ""
    echo "Commands:"
    echo "  start   - Stop any running instances, install dependencies, and start"
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
        sleep 1
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
