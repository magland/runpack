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
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { RefreshButton } from '../components/RefreshButton';
import { formatRelativeTime } from '../utils/formatTime';
import type { AdminRunnersResponse } from '../types';

export function Runners() {
  const navigate = useNavigate();
  const [runners, setRunners] = useState<AdminRunnersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRunners = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getRunners();
      setRunners(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load runners');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRunners();
  }, []);

  const handleRowClick = (runnerId: string) => {
    navigate(`/runners/${runnerId}`);
  };

  if (loading && !runners) {
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
        <Typography variant="h4">Runners</Typography>
        <RefreshButton onRefresh={loadRunners} loading={loading} />
      </Box>

      {runners && runners.runners.length === 0 ? (
        <Alert severity="info">No runners found</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Runner ID</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Capabilities</TableCell>
                <TableCell>Last Seen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {runners?.runners.map((runner) => (
                <TableRow
                  key={runner.runner_id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleRowClick(runner.runner_id)}
                >
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                    {runner.runner_id.substring(0, 8)}...
                  </TableCell>
                  <TableCell>{runner.name}</TableCell>
                  <TableCell>
                    <Chip
                      label={runner.is_active ? 'Active' : 'Inactive'}
                      color={runner.is_active ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {runner.capabilities.map((cap) => (
                        <Chip key={cap} label={cap} size="small" variant="outlined" />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell>{formatRelativeTime(runner.last_seen)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {runners && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Total: {runners.total} runner{runners.total !== 1 ? 's' : ''}
          {' | '}
          Active: {runners.runners.filter(r => r.is_active).length}
        </Typography>
      )}
    </Box>
  );
}
