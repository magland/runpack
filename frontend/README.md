# Runpack Frontend

Admin dashboard for monitoring and managing the Runpack distributed job computation system.

## Features

- **Dashboard**: View real-time statistics for jobs and runners
- **Jobs Management**: Browse, filter, and view detailed job information
- **Runners Monitoring**: Track active runners and their job history
- **Job Playground**: Submit test jobs with custom parameters
- **Settings**: Configure API keys for worker access

## Technology Stack

- **React 18** - UI library
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Material-UI (MUI)** - Component library
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **date-fns** - Date formatting utilities

## Setup

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Configuration

On first launch, navigate to the Settings page and configure your API keys:

- **Admin API Key**: Required for accessing admin endpoints (jobs, runners, stats)
- **Submit API Key**: Required for submitting jobs in the playground

API keys are stored securely in your browser's local storage.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run deploy` - Build and deploy to Cloudflare Pages
- `npm run lint` - Run ESLint

## Project Structure

```
frontend/
├── src/
│   ├── api/
│   │   └── client.ts          # API client with axios
│   ├── components/
│   │   ├── Layout.tsx         # Main layout with sidebar
│   │   ├── Sidebar.tsx        # Navigation sidebar
│   │   └── RefreshButton.tsx  # Reusable refresh button
│   ├── pages/
│   │   ├── Dashboard.tsx      # Statistics dashboard
│   │   ├── Jobs.tsx           # Jobs list
│   │   ├── JobDetail.tsx      # Single job details
│   │   ├── Runners.tsx        # Runners list
│   │   ├── RunnerDetail.tsx   # Single runner details
│   │   ├── Playground.tsx     # Job submission playground
│   │   └── Settings.tsx       # API key configuration
│   ├── hooks/
│   │   └── useApiKeys.ts      # Custom hook for API keys
│   ├── types/
│   │   └── index.ts           # TypeScript type definitions
│   ├── utils/
│   │   └── formatTime.ts      # Time formatting utilities
│   ├── App.tsx                # Main app component
│   └── main.tsx               # Entry point
├── public/                     # Static assets
├── index.html                  # HTML template
├── vite.config.ts             # Vite configuration
├── tsconfig.json              # TypeScript configuration
└── package.json               # Dependencies and scripts
```

## API Integration

The frontend connects to the Runpack worker API at:
```
https://runpack-worker.neurosift.app
```

### Endpoints Used

- `GET /api/admin/stats` - Dashboard statistics
- `GET /api/admin/jobs` - Jobs list with optional filtering
- `GET /api/admin/jobs/:jobId` - Job details
- `GET /api/admin/runners` - Runners list
- `GET /api/admin/runners/:runnerId` - Runner details with jobs
- `POST /api/jobs/submit` - Submit a new job (playground)

## Features Detail

### Dashboard
- Real-time job statistics by status
- Active runner count
- Visual cards with color-coded metrics

### Jobs Page
- Table view of all jobs
- Filter by status (pending, in_progress, completed, failed, etc.)
- Relative timestamps
- Click row to view details

### Job Detail Page
- Complete job information
- Input parameters (formatted JSON)
- Output results (formatted JSON)
- Console output
- Progress tracking for in-progress jobs
- Error messages for failed jobs

### Runners Page
- Table view of all runners
- Active/inactive status indicators
- Capabilities list
- Click row to view details

### Runner Detail Page
- Runner information
- Active status
- Capabilities
- List of jobs claimed/completed by the runner

### Playground
- Simple interface for job submission
- JSON editor for input parameters
- Real-time JSON validation
- Link to view submitted job details

### Settings
- Configure Admin API Key
- Configure Submit API Key
- Clear all keys
- Local storage persistence

## Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory, ready to be deployed to any static hosting service.

## Development Notes

- Light mode only (as specified)
- Relative timestamps using date-fns
- No auto-refresh (manual refresh buttons provided)
- Material-UI default theme
- All API keys stored in localStorage

## License

MIT
