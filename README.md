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
   ```

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

### Production Setup with Existing Nginx

This guide assumes you have:
- A Debian-like system (Ubuntu, Debian, etc.)
- Nginx already installed and running
- Docker and Docker Compose installed
- Root access or sudo privileges

1. **Set up SSL certificates**:
   ```bash
   # Stop Nginx temporarily
   sudo systemctl stop nginx

   # Get SSL certificates
   sudo certbot certonly --standalone -d dd.ethzero.club -d dd-api.ethzero.club

   # Start Nginx back
   sudo systemctl start nginx
   ```

2. **Create application directory**:
   ```bash
   # Create app directory
   sudo mkdir -p /opt/dd
   sudo chown $USER:$USER /opt/dd
   cd /opt/dd

   # Create backup directory
   sudo mkdir -p /opt/dd/backups
   ```

3. **Clone and configure the application**:
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

4. **Configure Nginx**:
   ```bash
   # Create Nginx configuration
   sudo nano /etc/nginx/sites-available/dd
   ```

   Add this configuration:
   ```nginx
   # Frontend
   server {
       listen 80;
       server_name dd.ethzero.club;
       return 301 https://$server_name$request_uri;
   }

   server {
       listen 443 ssl;
       server_name dd.ethzero.club;

       ssl_certificate /etc/letsencrypt/live/dd.ethzero.club/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/dd.ethzero.club/privkey.pem;

       location / {
           proxy_pass http://localhost:54287;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }

   # Backend
   server {
       listen 80;
       server_name dd-api.ethzero.club;
       return 301 https://$server_name$request_uri;
   }

   server {
       listen 443 ssl;
       server_name dd-api.ethzero.club;

       ssl_certificate /etc/letsencrypt/live/dd-api.ethzero.club/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/dd-api.ethzero.club/privkey.pem;

       location / {
           proxy_pass http://localhost:56000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

   Enable the configuration:
   ```bash
   sudo ln -s /etc/nginx/sites-available/dd /etc/nginx/sites-enabled/
   sudo nginx -t  # Test configuration
   sudo systemctl reload nginx
   ```

5. **Deploy the application**:
   ```bash
   # Build and start services
   docker compose -f docker-compose.prod.yml build
   docker compose -f docker-compose.prod.yml up -d

   # Verify services are running
   docker compose -f docker-compose.prod.yml ps
   ```

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

## Documentation

- [API Documentation](docs/API.md)
- [Frontend Documentation](docs/Frontend.md)
- [Backend Documentation](docs/Backend.md)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
