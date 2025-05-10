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

### Initial Server Setup

1. Update system and install requirements:
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install -y docker.io docker-compose nginx certbot python3-certbot-nginx
   ```

2. Create required directories:
   ```bash
   mkdir -p /path/to/app/{nginx/conf.d,nginx/ssl,nginx/logs,static,backups}
   ```

3. Set up SSL certificates:
   ```bash
   sudo certbot certonly --standalone -d dd.ethzero.club -d dd-api.ethzero.club
   sudo cp -r /etc/letsencrypt/live/* /path/to/app/nginx/ssl/
   ```

### Deployment Process

1. Clone and configure:
   ```bash
   git clone https://github.com/yourusername/DD.git /path/to/app
   cd /path/to/app
   cp .env.example .env
   ```

2. Edit `.env` for production:
   ```env
   FRONTEND_DOMAIN=dd.ethzero.club
   BACKEND_DOMAIN=dd-api.ethzero.club
   FRONTEND_URL=https://dd.ethzero.club
   BACKEND_URL=https://dd-api.ethzero.club
   ```

3. Deploy the application:
   ```bash
   docker compose -f docker-compose.prod.yml build
   docker compose -f docker-compose.prod.yml up -d
   ```

4. Set up automatic backups:
   ```bash
   chmod +x scripts/backup.sh
   (crontab -l 2>/dev/null; echo "0 2 * * * /path/to/app/scripts/backup.sh") | crontab -
   ```

### Security Hardening

1. Set proper permissions:
   ```bash
   sudo chown -R root:root /path/to/app/nginx
   sudo chmod -R 600 /path/to/app/nginx/ssl
   ```

2. Configure firewall:
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
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
