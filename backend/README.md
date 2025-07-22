# Attendance Backend API

Backend API for the attendance monitoring system with QR code functionality.

## Features

- User authentication (login/register)
- Subject management for teachers
- Student enrollment via QR codes
- Attendance tracking with QR codes
- Real-time session management
- Automatic absent marking

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp env.example .env
# Edit .env with your database credentials
```

3. Start the development server:
```bash
npm run dev
```

## Railway Deployment

### Prerequisites

1. Create a Railway account at [railway.app](https://railway.app)
2. Install Railway CLI (optional):
```bash
npm install -g @railway/cli
```

### Deployment Steps

1. **Create a new Railway project:**
   - Go to Railway dashboard
   - Click "New Project"
   - Choose "Deploy from GitHub repo"

2. **Connect your repository:**
   - Select your GitHub repository
   - Railway will detect the backend folder

3. **Set up PostgreSQL database:**
   - In your Railway project, click "New"
   - Select "Database" → "PostgreSQL"
   - Railway will provide a `DATABASE_URL`

4. **Configure environment variables:**
   - Go to your project settings
   - Add these environment variables:
     ```
     DATABASE_URL=your_railway_postgres_url
     NODE_ENV=production
     FRONTEND_URL=https://your-frontend-domain.com
     ```

5. **Deploy:**
   - Railway will automatically deploy when you push to your main branch
   - Or manually trigger deployment from the dashboard

### Database Setup

After deployment, you need to create the database tables:

1. **Option 1: Use Railway's PostgreSQL console**
   - Go to your PostgreSQL service in Railway
   - Click "Connect" → "Query"
   - Run the SQL scripts from `scripts/create-database.sql`

2. **Option 2: Use a database client**
   - Connect to your Railway PostgreSQL using the connection details
   - Run the database creation scripts

### Health Check

Your API will be available at:
- Health check: `https://your-app-name.railway.app/health`
- API base: `https://your-app-name.railway.app/api/auth`

## API Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/scan` - QR code scanning
- `GET /api/auth/teacher/subjects` - Get teacher's subjects
- `POST /api/auth/subjects` - Create new subject
- `GET /api/auth/subjects/:id` - Get subject details
- `POST /api/auth/subjects/:id/sessions` - Start attendance session
- `PUT /api/auth/sessions/:id/stop` - Stop attendance session

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `PORT` | Server port (Railway sets this) | No |
| `NODE_ENV` | Environment (production/development) | No |
| `FRONTEND_URL` | Frontend URL for CORS | No |

## Troubleshooting

1. **Database connection issues:**
   - Verify `DATABASE_URL` is correct
   - Check if database tables exist
   - Ensure PostgreSQL service is running

2. **CORS errors:**
   - Update `FRONTEND_URL` in environment variables
   - Check if frontend domain is correct

3. **Build failures:**
   - Ensure all dependencies are in `package.json`
   - Check Node.js version compatibility
   - Verify `start` script exists

## Support

For Railway-specific issues, check the Railway documentation and logs in your project dashboard. 