import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Snackbar,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { RefreshButton } from '../components/RefreshButton';
import { formatRelativeTime } from '../utils/formatTime';
import type { AdminJobsResponse, JobStatus } from '../types';

const STATUS_COLORS: Record<JobStatus, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  pending: 'info',
  claimed: 'secondary',
  in_progress: 'warning',
  completed: 'success',
  failed: 'error',
  expired: 'default',
};

export function Jobs() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<AdminJobsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const loadJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getJobs(
        statusFilter === 'all' ? undefined : statusFilter
      );
      setJobs(data);
      // Clear selection after refresh
      setSelectedJobs(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, [statusFilter]);

  const handleRowClick = (jobId: string, event: React.MouseEvent) => {
    // Don't navigate if clicking on checkbox or delete button
    if ((event.target as HTMLElement).closest('.MuiCheckbox-root, .MuiIconButton-root')) {
      return;
    }
    navigate(`/jobs/${jobId}`);
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked && jobs) {
      setSelectedJobs(new Set(jobs.jobs.map(job => job.job_id)));
    } else {
      setSelectedJobs(new Set());
    }
  };

  const handleSelectJob = (jobId: string) => {
    const newSelected = new Set(selectedJobs);
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId);
    } else {
      newSelected.add(jobId);
    }
    setSelectedJobs(newSelected);
  };

  const handleDeleteClick = (jobId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setJobToDelete(jobId);
    setDeleteDialogOpen(true);
  };

  const handleBatchDeleteClick = () => {
    if (selectedJobs.size > 0) {
      setJobToDelete(null);
      setDeleteDialogOpen(true);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleteDialogOpen(false);
    
    try {
      if (jobToDelete) {
        // Single delete
        await apiClient.deleteJob(jobToDelete);
        setSnackbar({
          open: true,
          message: 'Job deleted successfully',
          severity: 'success',
        });
      } else if (selectedJobs.size > 0) {
        // Batch delete
        const result = await apiClient.deleteJobs(Array.from(selectedJobs));
        if (result.failed.length > 0) {
          setSnackbar({
            open: true,
            message: `Deleted ${result.deleted} jobs, ${result.failed.length} failed`,
            severity: 'warning',
          });
        } else {
          setSnackbar({
            open: true,
            message: `Successfully deleted ${result.deleted} job${result.deleted !== 1 ? 's' : ''}`,
            severity: 'success',
          });
        }
        setSelectedJobs(new Set());
      }
      
      // Reload jobs
      await loadJobs();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to delete job(s)',
        severity: 'error',
      });
    }
    
    setJobToDelete(null);
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setJobToDelete(null);
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const isAllSelected = jobs ? jobs.jobs.length > 0 && selectedJobs.size === jobs.jobs.length : false;
  const isSomeSelected = selectedJobs.size > 0 && !isAllSelected;

  if (loading && !jobs) {
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

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Jobs</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value as JobStatus | 'all')}
              size="small"
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="claimed">Claimed</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
              <MenuItem value="expired">Expired</MenuItem>
            </Select>
          </FormControl>
          <RefreshButton onRefresh={loadJobs} loading={loading} />
        </Box>
      </Box>

      {jobs && jobs.jobs.length === 0 ? (
        <Alert severity="info">No jobs found</Alert>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={isSomeSelected}
                      checked={isAllSelected}
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                  <TableCell>Job ID</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Updated</TableCell>
                  <TableCell>Claimed By</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {jobs?.jobs.map((job) => (
                  <TableRow
                    key={job.job_id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={(e) => handleRowClick(job.job_id, e)}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedJobs.has(job.job_id)}
                        onChange={() => handleSelectJob(job.job_id)}
                      />
                    </TableCell>
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
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                      {job.claimed_by ? `${job.claimed_by.substring(0, 8)}...` : '-'}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={(e) => handleDeleteClick(job.job_id, e)}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {jobs && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Total: {jobs.total} job{jobs.total !== 1 ? 's' : ''}
              {selectedJobs.size > 0 && ` • ${selectedJobs.size} selected`}
            </Typography>
          )}
        </>
      )}

      {/* Floating action bar for batch operations */}
      {selectedJobs.size > 0 && (
        <Paper
          sx={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            p: 2,
            display: 'flex',
            gap: 2,
            alignItems: 'center',
            boxShadow: 3,
            zIndex: 1000,
          }}
        >
          <Typography variant="body2">
            {selectedJobs.size} job{selectedJobs.size !== 1 ? 's' : ''} selected
          </Typography>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleBatchDeleteClick}
            size="small"
          >
            Delete
          </Button>
          <Button
            variant="outlined"
            onClick={() => setSelectedJobs(new Set())}
            size="small"
          >
            Clear Selection
          </Button>
        </Paper>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {jobToDelete
              ? 'Are you sure you want to delete this job? This action cannot be undone.'
              : `Are you sure you want to delete ${selectedJobs.size} job${selectedJobs.size !== 1 ? 's' : ''}? This action cannot be undone.`
            }
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
