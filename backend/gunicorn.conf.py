import os
import multiprocessing

# Server socket
bind = f"0.0.0.0:{os.getenv('BACKEND_PORT', '56000')}"
backlog = 2048

# Worker processes
workers = 4
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 1000
timeout = 30
keepalive = 2
preload_app = True

# Restart workers after this many requests, to help prevent memory leaks
max_requests = 1000
max_requests_jitter = 50

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"

# Process naming
proc_name = "family_assistant"

# Global worker counter
worker_counter = 0

def post_fork(server, worker):
    """Called just after a worker has been forked."""
    global worker_counter
    # Use a simple counter for worker IDs
    worker_id = worker_counter
    worker_counter += 1
    
    os.environ['WORKER_ID'] = str(worker_id)
    server.log.info(f"Worker {worker.pid} started with WORKER_ID={worker_id}")

def when_ready(server):
    """Called just after the server is started."""
    server.log.info("Server is ready. Spawning workers.")

def worker_abort(worker):
    """Called when a worker receives the SIGABRT signal."""
    worker.log.info(f"Worker {worker.pid} received SIGABRT signal")

def pre_exec(server):
    """Called just before a new master process is forked."""
    server.log.info("Forked child, re-executing.")

def on_exit(server):
    """Called just before exiting."""
    server.log.info("Shutting down: Master")

def on_reload(server):
    """Called to recycle workers during a reload via SIGHUP."""
    global worker_counter
    worker_counter = 0  # Reset counter on reload
    server.log.info("Reloading: Master") 