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

# Backend configuration
export OLYMPIAD_DATABASE_PATH="$SCRIPT_DIR/backend/olympiad.db"
export OLYMPIAD_SCHEMA_PATH="$SCRIPT_DIR/backend/schema.sql"
export OLYMPIAD_LOG_DIR="$SCRIPT_DIR/backend/logs"

stop() {
    echo -e "${RED}Stopping application...${NC}"

    # Delete database file
    if [ -f "$OLYMPIAD_DATABASE_PATH" ]; then
        echo "Deleting database file..."
        rm "$OLYMPIAD_DATABASE_PATH"
    fi

    # Kill processes on backend port
    if lsof -ti:$BACKEND_PORT > /dev/null 2>&1; then
        echo "Stopping backend (port $BACKEND_PORT)..."
        lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null
    fi

    # Kill processes on frontend port
    if lsof -ti:$FRONTEND_PORT > /dev/null 2>&1; then
        echo "Stopping frontend (port $FRONTEND_PORT)..."
        lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null
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
    cd "$SCRIPT_DIR"
    uvicorn backend.src.main:app --reload --host 0.0.0.0 --port $BACKEND_PORT &

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

purge() {
    echo -e "${RED}Purging all dependencies...${NC}"

    # Stop any running processes first
    stop

    # Delete node_modules
    if [ -d "$SCRIPT_DIR/node_modules" ]; then
        echo "Removing node_modules..."
        rm -rf "$SCRIPT_DIR/node_modules"
    fi

    # Delete venv
    if [ -d "$SCRIPT_DIR/venv" ]; then
        echo "Removing Python virtual environment..."
        rm -rf "$SCRIPT_DIR/venv"
    fi

    # Delete database file
    if [ -f "$OLYMPIAD_DATABASE_PATH" ]; then
        echo "Removing database file..."
        rm "$OLYMPIAD_DATABASE_PATH"
    fi

    echo -e "${GREEN}All dependencies purged. Run './run.sh start' to rebuild from scratch.${NC}"
}

backend() {
    echo -e "${GREEN}Starting backend only...${NC}"

    # Use test database
    export OLYMPIAD_DATABASE_PATH="$SCRIPT_DIR/backend/testdb.db"

    cd "$SCRIPT_DIR"

    # Create virtual environment if it doesn't exist
    if [ ! -d "$SCRIPT_DIR/venv" ]; then
        echo "Creating Python virtual environment..."
        python3 -m venv "$SCRIPT_DIR/venv"
    fi

    # Activate virtual environment
    source "$SCRIPT_DIR/venv/bin/activate"

    # Install dependencies
    echo "Installing backend dependencies..."
    pip install -r "$SCRIPT_DIR/backend/requirements.txt" -q

    echo -e "${GREEN}Starting backend server...${NC}"
    cd "$SCRIPT_DIR"
    uvicorn backend.src.main:app --reload --host 0.0.0.0 --port $BACKEND_PORT

    wait
}

test_backend() {
    echo -e "${YELLOW}Running backend tests...${NC}"

    # Use test database
    export OLYMPIAD_DATABASE_PATH="$SCRIPT_DIR/backend/testdb.db"

    cd "$SCRIPT_DIR"

    # Create virtual environment if it doesn't exist
    if [ ! -d "$SCRIPT_DIR/venv" ]; then
        echo "Creating Python virtual environment..."
        python3 -m venv "$SCRIPT_DIR/venv"
    fi

    # Activate virtual environment
    source "$SCRIPT_DIR/venv/bin/activate"

    # Install dependencies
    echo "Installing backend dependencies..."
    pip install -r "$SCRIPT_DIR/backend/requirements.txt" -q

    cd "$SCRIPT_DIR"
    pytest backend/tests/ -v
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
    echo "Usage: $0 {start|stop|restart|status|purge|backend|test_backend}"
    echo ""
    echo "Commands:"
    echo "  start        - Stop any running instances, install dependencies, and start"
    echo "  stop         - Stop both frontend and backend"
    echo "  restart      - Stop and start the application"
    echo "  status       - Check if the application is running"
    echo "  purge        - Remove all dependencies (node_modules, venv, db) for a clean rebuild"
    echo "  backend      - Run backend only with test database"
    echo "  test_backend - Run backend tests"
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
    purge)
        purge
        ;;
    backend)
        backend
        ;;
    test_backend)
        test_backend
        ;;
    *)
        usage
        exit 1
        ;;
esac
