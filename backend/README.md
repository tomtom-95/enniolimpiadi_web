# Backend

## Setup

1. Create and activate a virtual environment:
```bash
python -m venv .venv
source .venv/bin/activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

## Running the Server

```bash
uvicorn main:app --reload
```

## Running Tests

```bash
pytest tests.py
```
