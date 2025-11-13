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
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { RefreshButton } from '../components/RefreshButton';
import { formatRelativeTime } from '../utils/formatTime';
import type { AdminJobDetailResponse, JobStatus } from '../types';

const STATUS_COLORS: Record<JobStatus, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  pending: 'info',
  claimed: 'secondary',
  in_progress: 'warning',
  completed: 'success',
  failed: 'error',
  expired: 'default',
};

export function JobDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<AdminJobDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const loadJob = async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getJobDetail(jobId);
      setJob(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJob();
  }, [jobId]);

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    setDeleteDialogOpen(false);
    
    if (!jobId) return;
    
    try {
      await apiClient.deleteJob(jobId);
      setSnackbar({
        open: true,
        message: 'Job deleted successfully',
        severity: 'success',
      });
      // Navigate back to jobs list after a brief delay
      setTimeout(() => {
        navigate('/jobs');
      }, 1000);
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to delete job',
        severity: 'error',
      });
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
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
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/jobs')} sx={{ mt: 2 }}>
          Back to Jobs
        </Button>
      </Box>
    );
  }

  if (!job) return null;

  const progressPercent = job.progress
    ? (job.progress.current / job.progress.total) * 100
    : 0;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/jobs')}>
            Back
          </Button>
          <Typography variant="h4">Job Details</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleDeleteClick}
          >
            Delete Job
          </Button>
          <RefreshButton onRefresh={loadJob} loading={loading} />
        </Box>
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Basic Information
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              Job ID
            </Typography>
            <Typography variant="body1" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {job.job_id}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              Job Type
            </Typography>
            <Typography variant="body1">{job.job_type}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              Status
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              <Chip label={job.status} color={STATUS_COLORS[job.status]} />
            </Box>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              Created
            </Typography>
            <Typography variant="body1">{formatRelativeTime(job.created_at)}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              Updated
            </Typography>
            <Typography variant="body1">{formatRelativeTime(job.updated_at)}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              Claimed By
            </Typography>
            <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
              {job.claimed_by || '-'}
            </Typography>
          </Grid>
          {job.claimed_at && (
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                Claimed At
              </Typography>
              <Typography variant="body1">{formatRelativeTime(job.claimed_at)}</Typography>
            </Grid>
          )}
          {job.last_heartbeat && (
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                Last Heartbeat
              </Typography>
              <Typography variant="body1">{formatRelativeTime(job.last_heartbeat)}</Typography>
            </Grid>
          )}
        </Grid>
      </Paper>

      {job.progress && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Progress
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {job.progress.current} / {job.progress.total}
          </Typography>
          <LinearProgress variant="determinate" value={progressPercent} sx={{ height: 10, borderRadius: 1 }} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {progressPercent.toFixed(1)}%
          </Typography>
        </Paper>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Input Parameters
        </Typography>
        <Box
          component="pre"
          sx={{
            p: 2,
            bgcolor: 'grey.100',
            borderRadius: 1,
            overflow: 'auto',
            fontSize: '0.875rem',
            fontFamily: 'monospace',
          }}
        >
          {JSON.stringify(job.input_params, null, 2)}
        </Box>
      </Paper>

      {job.output_data && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Output Result
          </Typography>
          <Box
            component="pre"
            sx={{
              p: 2,
              bgcolor: 'grey.100',
              borderRadius: 1,
              overflow: 'auto',
              fontSize: '0.875rem',
              fontFamily: 'monospace',
            }}
          >
            {JSON.stringify(job.output_data, null, 2)}
          </Box>
        </Paper>
      )}

      {job.console_output && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Console Output
          </Typography>
          <Box
            component="pre"
            sx={{
              p: 2,
              bgcolor: 'grey.900',
              color: 'grey.100',
              borderRadius: 1,
              overflow: 'auto',
              fontSize: '0.875rem',
              fontFamily: 'monospace',
              maxHeight: 400,
            }}
          >
            {job.console_output}
          </Box>
        </Paper>
      )}

      {job.error_message && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom color="error">
            Error Message
          </Typography>
          <Alert severity="error">{job.error_message}</Alert>
        </Paper>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this job? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
