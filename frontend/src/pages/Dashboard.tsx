import { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Work as WorkIcon,
  Computer as ComputerIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { apiClient } from '../api/client';
import { RefreshButton } from '../components/RefreshButton';
import type { AdminStatsResponse } from '../types';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box sx={{ color, mr: 2 }}>{icon}</Box>
          <Typography variant="h6" color="text.secondary">
            {title}
          </Typography>
        </Box>
        <Typography variant="h3">{value}</Typography>
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!stats) return null;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Dashboard</Typography>
        <RefreshButton onRefresh={loadStats} loading={loading} />
      </Box>

      <Typography variant="h6" gutterBottom sx={{ mt: 4, mb: 2 }}>
        Jobs Overview
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Jobs"
            value={stats.jobs.total}
            icon={<WorkIcon fontSize="large" />}
            color="primary.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Pending"
            value={stats.jobs.pending}
            icon={<WorkIcon fontSize="large" />}
            color="info.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="In Progress"
            value={stats.jobs.in_progress}
            icon={<WorkIcon fontSize="large" />}
            color="warning.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Completed"
            value={stats.jobs.completed}
            icon={<CheckCircleIcon fontSize="large" />}
            color="success.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Failed"
            value={stats.jobs.failed}
            icon={<ErrorIcon fontSize="large" />}
            color="error.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Claimed"
            value={stats.jobs.claimed}
            icon={<WorkIcon fontSize="large" />}
            color="secondary.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Expired"
            value={stats.jobs.expired}
            icon={<WorkIcon fontSize="large" />}
            color="text.disabled"
          />
        </Grid>
      </Grid>

      <Typography variant="h6" gutterBottom sx={{ mt: 4, mb: 2 }}>
        Runners Overview
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Runners"
            value={stats.runners.total}
            icon={<ComputerIcon fontSize="large" />}
            color="primary.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Runners"
            value={stats.runners.active}
            icon={<ComputerIcon fontSize="large" />}
            color="success.main"
          />
        </Grid>
      </Grid>
    </Box>
  );
}
