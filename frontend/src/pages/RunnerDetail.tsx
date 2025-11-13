import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { RefreshButton } from '../components/RefreshButton';
import { formatRelativeTime } from '../utils/formatTime';
import type { AdminRunnerDetailResponse, JobStatus } from '../types';

const STATUS_COLORS: Record<JobStatus, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  pending: 'info',
  claimed: 'secondary',
  in_progress: 'warning',
  completed: 'success',
  failed: 'error',
  expired: 'default',
};

export function RunnerDetail() {
  const { runnerId } = useParams<{ runnerId: string }>();
  const navigate = useNavigate();
  const [runner, setRunner] = useState<AdminRunnerDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRunner = async () => {
    if (!runnerId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getRunnerDetail(runnerId);
      setRunner(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load runner details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRunner();
  }, [runnerId]);

  const handleJobClick = (jobId: string) => {
    navigate(`/jobs/${jobId}`);
  };

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
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/runners')} sx={{ mt: 2 }}>
          Back to Runners
        </Button>
      </Box>
    );
  }

  if (!runner) return null;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/runners')}>
            Back
          </Button>
          <Typography variant="h4">Runner Details</Typography>
        </Box>
        <RefreshButton onRefresh={loadRunner} loading={loading} />
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Basic Information
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              Runner ID
            </Typography>
            <Typography variant="body1" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {runner.runner_id}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              Name
            </Typography>
            <Typography variant="body1">{runner.name}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              Status
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              <Chip
                label={runner.is_active ? 'Active' : 'Inactive'}
                color={runner.is_active ? 'success' : 'default'}
              />
            </Box>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              Registered
            </Typography>
            <Typography variant="body1">{formatRelativeTime(runner.registered_at)}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              Last Seen
            </Typography>
            <Typography variant="body1">{formatRelativeTime(runner.last_seen)}</Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Capabilities
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {runner.capabilities.map((cap) => (
                <Chip key={cap} label={cap} variant="outlined" />
              ))}
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Jobs ({runner.jobs.length})
        </Typography>
        {runner.jobs.length === 0 ? (
          <Alert severity="info">No jobs found for this runner</Alert>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Job ID</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Updated</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {runner.jobs.map((job) => (
                  <TableRow
                    key={job.job_id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleJobClick(job.job_id)}
                  >
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                      {job.job_id.substring(0, 8)}...
                    </TableCell>
                    <TableCell>{job.job_type}</TableCell>
                    <TableCell>
                      <Chip
                        label={job.status}
                        color={STATUS_COLORS[job.status]}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{formatRelativeTime(job.created_at)}</TableCell>
                    <TableCell>{formatRelativeTime(job.updated_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}
