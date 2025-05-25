# Assistant de Vie Familiale

## Description du projet

L'Assistant de Vie Familiale est une application web concue pour aider les familles a gerer les taches quotidiennes, les privileges et les regles etablies entre parents et enfants. L'application permet de creer un systeme de recompenses base sur le respect des regles et l'accomplissement des taches.

### Fonctionnalites principales

- **Gestion des profils** : Parents et enfants avec nom et date de naissance
- **Calendrier** : Affichage des taches, privileges et infractions en vue personnelle ou familiale
- **Taches** : 
  - Assignation de taches aux enfants par les parents
  - Suivi de l'etat des taches (fait/pas fait)
  - Possibilite pour chaque personne de marquer ses taches comme terminees
- **Privileges** : 
  - Attribution de privileges aux enfants (ex: dessert, temps d'ecran)
  - Statut des privileges (merite/non merite)
- **Regles et infractions** : 
  - Enregistrement des infractions aux regles etablies
  - Historique des infractions
- **Contrats** : 
  - Definition d'un ensemble de regles structurees entre parents et enfants
  - Recompenses automatiques lorsque toutes les conditions sont remplies
- **Portefeuille virtuel** : 
  - Suivi du solde accumule par chaque enfant
  - Historique des transactions
  - Conversion des euros virtuels en euros reels par les parents

### Exemple de contrat

**Contrat entre Elea et papa** :  
Elea recevra 1€ chaque jour ou elle remplira les conditions suivantes :
- pas peter pres des autres  
- pas de doigt dans le nez ni la bouche  
- pas de crise  
- pas roter  
- pas sortir de son lit le soir  
- faire toutes les taches du tableau  
- pas de violence  

Ce contrat prendra fin le 1er Juillet 2025.

## Development Setup

### Prerequisites

- Docker
- Docker Compose

### Local Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/DD.git
   cd DD
   ```

2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` for local development:
   ```env
   FRONTEND_DOMAIN=localhost
   BACKEND_DOMAIN=localhost
   FRONTEND_URL=http://localhost:54287
   BACKEND_URL=http://localhost:56000
   VITE_API_BASE_URL=http://localhost:56000/api
   ```
   
   > **Important**: 
   > - The `VITE_API_BASE_URL` variable must be set correctly for the frontend to connect to the backend API. This variable is used during the build process.
   > - The `FRONTEND_URL` must match the URL that you use to access the frontend in your browser, as it's used for CORS configuration in the backend.

4. Start the development environment:
   ```bash
   docker compose up --build
   ```

The services will be accessible at:
- Frontend: http://localhost:54287
- Backend API: http://localhost:56000/api

## Production Deployment

### Prerequisites

- Linux server with Docker and Docker Compose installed
- Domain names configured (dd.ethzero.club and dd-api.ethzero.club)
- SSL certificates (Let's Encrypt recommended)

### Production Setup with Existing Apache2

This guide assumes you have:
- A Debian-like system (Ubuntu, Debian, etc.)
- Apache2 already installed and running
- Docker and Docker Compose installed
- Root access or sudo privileges

1. **Enable required Apache modules**:
   ```bash
   # Enable required modules
   sudo a2enmod proxy
   sudo a2enmod proxy_http
   sudo a2enmod proxy_wstunnel
   sudo a2enmod ssl
   sudo a2enmod rewrite

   # Restart Apache to apply changes
   sudo systemctl restart apache2
   ```

2. **Set up SSL certificates**:
   ```bash
   # Stop Apache temporarily
   sudo systemctl stop apache2

   # Get SSL certificates
   sudo certbot certonly --standalone -d dd.ethzero.club -d dd-api.ethzero.club

   # Start Apache back
   sudo systemctl start apache2
   ```

3. **Create application directory**:
   ```bash
   # Create app directory
   sudo mkdir -p /opt/dd
   sudo chown $USER:$USER /opt/dd
   cd /opt/dd

   # Create backup directory
   sudo mkdir -p /opt/dd/backups
   ```

4. **Clone and configure the application**:
   ```bash
   # Clone repository
   git clone https://github.com/yourusername/DD.git .

   # Copy and edit environment file
   cp .env.example .env
   nano .env  # Edit with your production values
   ```

   Edit `.env` with these values:
   ```env
   FRONTEND_DOMAIN=dd.ethzero.club
   BACKEND_DOMAIN=dd-api.ethzero.club
   FRONTEND_URL=https://dd.ethzero.club
   BACKEND_URL=https://dd-api.ethzero.club
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   SECRET_KEY=your_random_secret
   ```

5. **Configure Apache Virtual Hosts**:
   ```bash
   # Create virtual host configurations
   sudo nano /etc/apache2/sites-available/dd-frontend.conf
   ```

   Add this configuration for the frontend:
   ```apache
   <VirtualHost *:80>
       ServerName dd.ethzero.club
       Redirect permanent / https://dd.ethzero.club/
   </VirtualHost>

   <VirtualHost *:443>
       ServerName dd.ethzero.club
       ServerAdmin webmaster@dd.ethzero.club

       SSLEngine on
       SSLCertificateFile /etc/letsencrypt/live/dd.ethzero.club/fullchain.pem
       SSLCertificateKeyFile /etc/letsencrypt/live/dd.ethzero.club/privkey.pem

       ProxyPreserveHost On
       ProxyPass / http://localhost:54287/
       ProxyPassReverse / http://localhost:54287/

       # WebSocket support
       RewriteEngine On
       RewriteCond %{HTTP:Upgrade} =websocket [NC]
       RewriteRule /(.*) ws://localhost:54287/$1 [P,L]

       ErrorLog ${APACHE_LOG_DIR}/dd-frontend-error.log
       CustomLog ${APACHE_LOG_DIR}/dd-frontend-access.log combined
   </VirtualHost>
   ```

   Create backend configuration:
   ```bash
   sudo nano /etc/apache2/sites-available/dd-backend.conf
   ```

   Add this configuration for the backend:
   ```apache
   <VirtualHost *:80>
       ServerName dd-api.ethzero.club
       Redirect permanent / https://dd-api.ethzero.club/
   </VirtualHost>

   <VirtualHost *:443>
       ServerName dd-api.ethzero.club
       ServerAdmin webmaster@dd-api.ethzero.club

       SSLEngine on
       # Note: Both domains use the same certificate files from the primary domain
       SSLCertificateFile /etc/letsencrypt/live/dd.ethzero.club/fullchain.pem
       SSLCertificateKeyFile /etc/letsencrypt/live/dd.ethzero.club/privkey.pem

       ProxyPreserveHost On
       ProxyPass / http://localhost:56000/
       ProxyPassReverse / http://localhost:56000/

       # WebSocket support
       RewriteEngine On
       RewriteCond %{HTTP:Upgrade} =websocket [NC]
       RewriteRule /(.*) ws://localhost:56000/$1 [P,L]

       ErrorLog ${APACHE_LOG_DIR}/dd-backend-error.log
       CustomLog ${APACHE_LOG_DIR}/dd-backend-access.log combined
   </VirtualHost>
   ```

   Note: When using certbot with multiple domains in a single certificate request, all certificates are stored under the first domain's directory (`dd.ethzero.club` in this case). That's why both virtual hosts use the same certificate files.

   Enable the virtual hosts:
   ```bash
   sudo a2ensite dd-frontend
   sudo a2ensite dd-backend
   sudo apache2ctl configtest
   sudo systemctl reload apache2
   ```

5. **Deploy the application**:
   ```bash
   # Create and edit the environment file
   cp .env.example .env
   nano .env
   ```

   Add these values to `.env`:
   ```env
   # Domains
   FRONTEND_DOMAIN=dd.ethzero.club
   BACKEND_DOMAIN=dd-api.ethzero.club
   FRONTEND_URL=https://dd.ethzero.club
   BACKEND_URL=https://dd-api.ethzero.club

   # Ports (must match the ones in Apache configuration)
   FRONTEND_PORT=54287
   BACKEND_PORT=56000
   
   # IMPORTANT: This variable is used during the frontend build process
   # It must match your backend URL with the /api path
   VITE_API_BASE_URL=https://dd-api.ethzero.club/api

   # Database
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_NAME=dd_db
   DATABASE_URL=postgresql+asyncpg://your_db_user:your_db_password@db:5432/dd_db

   # Authentication
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   SECRET_KEY=your_random_secret_key
   ```
   
   > **Note**: The `VITE_API_BASE_URL` environment variable is critical for the frontend to correctly connect to the backend API. This variable is used during the build process and cannot be changed after the frontend is built without rebuilding the container.
   >
   > **Important**: The `FRONTEND_URL` environment variable is used by the backend for CORS configuration. It must exactly match the URL that users will use to access the frontend, including the protocol (http/https).

   Build and start the services:
   ```bash
   # Build and start services
   docker compose -f docker-compose.prod.yml build
   docker compose -f docker-compose.prod.yml up -d

   # Verify services are running
   docker compose -f docker-compose.prod.yml ps
   docker compose -f docker-compose.prod.yml logs

   # Test the services directly
   curl http://localhost:54287
   curl http://localhost:56000/api/health
   ```

   Note: The application services (frontend and backend) are exposed only to localhost. Apache2 acts as a reverse proxy, handling SSL termination and forwarding requests to these local ports.

6. **Set up automatic backups**:
   ```bash
   # Make backup script executable
   chmod +x scripts/backup.sh

   # Add to crontab (runs at 2 AM daily)
   (crontab -l 2>/dev/null; echo "0 2 * * * /opt/dd/scripts/backup.sh") | crontab -
   ```

7. **Set up log rotation**:
   ```bash
   sudo nano /etc/logrotate.d/dd
   ```

   Add this configuration:
   ```
   /opt/dd/backups/*.log {
       daily
       rotate 7
       compress
       delaycompress
       missingok
       notifempty
       create 640 root root
   }
   ```

8. **Verify the setup**:
   ```bash
   # Check application logs
   docker compose -f docker-compose.prod.yml logs

   # Test SSL certificates
   curl -vI https://dd.ethzero.club
   curl -vI https://dd-api.ethzero.club

   # Check backup directory permissions
   ls -la /opt/dd/backups
   ```

### Maintenance

1. Updates:
   ```bash
   git pull
   docker compose -f docker-compose.prod.yml build
   docker compose -f docker-compose.prod.yml up -d
   ```

2. Logs:
   ```bash
   docker compose -f docker-compose.prod.yml logs -f
   ```

3. Backup verification:
   ```bash
   ls -l /path/to/app/backups
   ```

## Scheduler Monitoring

The application includes comprehensive monitoring scripts to track the scheduler's health and status. These scripts help ensure the daily rewards and recurring tasks are processed correctly.

### Monitoring Scripts

#### `scripts/monitor_scheduler.sh` - Start Monitoring

Starts a background process that continuously monitors the scheduler endpoints and logs the results.

**Usage:**
```bash
./scripts/monitor_scheduler.sh [start]
```

**Environment Variables:**
- `BACKEND_URL` - Backend URL (default: `http://localhost:56000`)
- `LOG_DIR` - Log directory (default: `./logs`)
- `MONITOR_INTERVAL` - Check interval in seconds (default: `30`)

**Examples:**
```bash
# Start monitoring with default settings
./scripts/monitor_scheduler.sh

# Start monitoring with custom interval (5 seconds)
MONITOR_INTERVAL=5 ./scripts/monitor_scheduler.sh

# Start monitoring with custom backend URL
BACKEND_URL=http://localhost:8000 ./scripts/monitor_scheduler.sh

# Monitor production backend
BACKEND_URL=https://dd-api.ethzero.club ./scripts/monitor_scheduler.sh
```

#### `scripts/stop_monitor.sh` - Stop Monitoring

Stops the monitoring process and shows monitoring statistics.

**Usage:**
```bash
./scripts/stop_monitor.sh [stop|status]
```

**Examples:**
```bash
# Stop monitoring
./scripts/stop_monitor.sh

# Check monitoring status
./scripts/stop_monitor.sh status
```

### Monitoring Features

#### Health Check Monitoring
- Calls `/api/health` endpoint every interval
- Logs full JSON response
- Shows color-coded console status:
  - 🟢 **Green**: Scheduler running with lock
  - 🟡 **Yellow**: Worker process (scheduler not running on this worker)
  - 🔴 **Red**: Backend unreachable or error

#### Detailed Status Monitoring
- Calls `/api/scheduler/status` endpoint every interval
- Logs detailed scheduler information including:
  - Process and worker information
  - Job schedules and next run times
  - Lock file status
- Shows scheduled jobs in console

#### Log File Format
The log file contains timestamped entries with:
- `HEALTH:` - Health endpoint responses
- `STATUS:` - Detailed status endpoint responses
- `MONITOR:` - Monitoring process events

**Example log entries:**
```
[2025-05-25 19:44:29] 🚀 MONITOR: Starting scheduler monitoring (PID: 12345)
[2025-05-25 19:44:29] 🔧 MONITOR: Backend URL: http://localhost:56000
[2025-05-25 19:44:29] 📊 MONITOR: Checking scheduler status...
[2025-05-25 19:44:29] HEALTH: {"status":"healthy","process_id":1,"scheduler":{"status":"running"}}
[2025-05-25 19:44:29] STATUS: {"process_info":{"process_id":1},"scheduler":{"running":true}}
```

### Use Cases

#### Development Monitoring
Monitor scheduler during development with frequent checks:
```bash
MONITOR_INTERVAL=10 ./scripts/monitor_scheduler.sh
```

#### Production Monitoring
Monitor scheduler in production with standard interval:
```bash
BACKEND_URL=https://dd-api.ethzero.club ./scripts/monitor_scheduler.sh
```

#### Debugging
Check detailed scheduler status:
```bash
./scripts/stop_monitor.sh status
tail -f ./logs/scheduler_monitor.log
```

#### Log Analysis
View recent monitoring activity:
```bash
tail -n 50 ./logs/scheduler_monitor.log
grep "HEALTH:" ./logs/scheduler_monitor.log | tail -10
grep "Jobs scheduled" ./logs/scheduler_monitor.log
```

### Scheduler Architecture

The application uses APScheduler with file-based coordination to prevent duplicate job execution in multi-worker environments:

- **File Lock Coordination**: Uses `fcntl.flock()` with exclusive locks
- **Lock File**: `/tmp/family_assistant_scheduler.lock`
- **Worker Coordination**: Only one worker across all processes runs the scheduler
- **Job Types**:
  - **Daily Rewards**: Processes contracts and credits wallets (runs at 00:00)
  - **Recurring Tasks**: Creates task instances for the next week (runs at 00:00)

### Troubleshooting

#### Backend Not Reachable
- Check if the backend is running: `docker ps`
- Verify the backend URL and port
- Check firewall/network connectivity

#### Monitoring Won't Start
- Check if already running: `./scripts/stop_monitor.sh status`
- Remove stale PID file: `rm -f ./logs/scheduler_monitor.pid`
- Check log directory permissions

#### Scheduler Issues
- Check scheduler logs: `docker compose logs backend | grep SCHEDULER`
- Verify lock file: `ls -la /tmp/family_assistant_scheduler.lock`
- Check job execution: `grep "daily_rewards\|recurring_tasks" ./logs/scheduler_monitor.log`

For more detailed monitoring documentation, see [scripts/README.md](scripts/README.md).

## Documentation

- [API Documentation](docs/API.md)
- [Frontend Documentation](docs/Frontend.md)
- [Backend Documentation](docs/Backend.md)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
