# Aegis Backend Deployment on AWS + Managed Mongo-Compatible DB (DocumentDB)

This guide deploys the Node backend first, then connects it to Amazon DocumentDB (AWS-managed Mongo-compatible database).

## Architecture (recommended)
- Backend: EC2 (Ubuntu 22.04) + PM2 + Nginx + TLS (Let's Encrypt)
- Database: Amazon DocumentDB (TLS enabled)
- Optional later: ElastiCache Redis for multi-instance Socket.IO

## Prerequisites
- AWS account and IAM user with EC2, VPC, Security Group, ACM/Route53 access
- Domain/subdomain for API (example: `api.yourdomain.com`)
- MongoDB data export from current database (if migrating existing data)

## 1) Create DocumentDB cluster
1. In AWS Console, create Amazon DocumentDB cluster.
2. Engine compatibility: choose latest supported Mongo compatibility.
3. Place cluster in private subnets.
4. Enable TLS.
5. Create DB user and password.
6. Security Group rules:
   - Inbound 27017 only from backend EC2 security group.
7. Download `global-bundle.pem` from AWS docs and keep it on EC2 (for TLS connection validation).

## 2) Launch backend EC2
1. Launch Ubuntu 22.04 EC2 in same VPC as DocumentDB.
2. Attach security group rules:
   - Inbound 22 from your IP.
   - Inbound 80/443 from internet.
   - Outbound all.
3. SSH into EC2 and install dependencies:

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx git
sudo npm i -g pm2
```

## 3) Upload backend code
Use one option:
- `git clone` your repo on EC2, or
- zip upload + unzip.

Then:

```bash
cd server
npm ci
cp .env.example .env
```

Edit `.env` with production values.

## 4) Configure MONGO_URI for DocumentDB
Use URI format (adjust host/user/pass/db/region):

```env
MONGO_URI=mongodb://<user>:<pass>@<docdb-endpoint>:27017/aegis3?tls=true&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false
```

Important for DocumentDB:
- `tls=true`
- `replicaSet=rs0`
- `retryWrites=false`

## 5) Start backend with PM2

```bash
cd server
pm2 start index.js --name aegis-api
pm2 save
pm2 startup
```

Health check should respond:

```bash
curl http://localhost:5000/health
```

## 6) Reverse proxy with Nginx
Create Nginx config:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/aegis-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 7) Enable HTTPS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

## 8) Update mobile app API URL
Build release with production backend URL:

```bash
flutter build appbundle --release --dart-define=API_BASE_URL=https://api.yourdomain.com/api
```

## 9) Migration from old MongoDB to DocumentDB
Use `mongodump` from old DB and `mongorestore` to DocumentDB.

High-level:
1. Put backend in maintenance mode.
2. Dump current DB.
3. Restore into DocumentDB.
4. Switch `MONGO_URI` and restart backend.
5. Validate core flows.

## 10) Post-deploy checks
- `GET /health` returns healthy and DB connected.
- Login/signup (email + Google) works.
- Image upload works (Cloudinary env vars loaded).
- Push notifications work (Firebase Admin env vars loaded).
- Socket/chat flows work.

## Notes specific to this repo
- Backend already supports env-based `MONGO_URI` in `server/config/db.js`.
- Backend already has `/health` endpoint in `server/index.js`.
- Redis is optional for single instance. Keep `SOCKET_ADAPTER=memory` initially.
- For zero-downtime scaling later: move to ECS/Fargate + ALB + ElastiCache Redis.
