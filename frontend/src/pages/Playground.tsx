import { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
  Container,
  Link,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useApiKeys } from '../hooks/useApiKeys';

export function Playground() {
  const navigate = useNavigate();
  const { hasSubmitKey } = useApiKeys();
  const [jobType, setJobType] = useState('hello_world');
  const [inputParams, setInputParams] = useState('{\n  "name": "Alice",\n  "processing_time": 10\n}');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ jobId: string; message: string } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateJson = (json: string): boolean => {
    try {
      JSON.parse(json);
      setValidationError(null);
      return true;
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Invalid JSON');
      return false;
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    if (!jobType.trim()) {
      setError('Job type is required');
      return;
    }

    if (!validateJson(inputParams)) {
      setError('Invalid JSON in input parameters');
      return;
    }

    setSubmitting(true);
    try {
      const params = JSON.parse(inputParams);
      const response = await apiClient.submitJob({
        job_type: jobType,
        input_params: params,
      });

      setSuccess({
        jobId: response.job_id,
        message: response.message,
      });

      // Reset form
      setJobType('');
      setInputParams('{\n  \n}');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit job');
    } finally {
      setSubmitting(false);
    }
  };

  if (!hasSubmitKey()) {
    return (
      <Container maxWidth="md">
        <Box sx={{ mt: 4 }}>
          <Alert severity="warning">
            Please configure your Submit API Key in{' '}
            <Link href="/settings" underline="hover">
              Settings
            </Link>{' '}
            to use the playground.
          </Alert>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Job Playground
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Test job submission by entering a job type and input parameters.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert
            severity="success"
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={() => navigate(`/jobs/${success.jobId}`)}>
                View Job
              </Button>
            }
          >
            {success.message}
          </Alert>
        )}

        <Paper sx={{ p: 3 }}>
          <TextField
            fullWidth
            label="Job Type"
            value={jobType}
            onChange={(e) => setJobType(e.target.value)}
            sx={{ mb: 3 }}
            placeholder="e.g., example_task"
            helperText="Enter the type of job to execute"
          />

          <Typography variant="body2" color="text.secondary" gutterBottom>
            Input Parameters (JSON)
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={12}
            value={inputParams}
            onChange={(e) => {
              setInputParams(e.target.value);
              validateJson(e.target.value);
            }}
            error={!!validationError}
            helperText={validationError || 'Enter job parameters as JSON'}
            sx={{
              mb: 3,
              '& .MuiInputBase-input': {
                fontFamily: 'monospace',
                fontSize: '0.875rem',
              },
            }}
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={submitting || !jobType.trim() || !!validationError}
            >
              {submitting ? 'Submitting...' : 'Submit Job'}
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                setJobType('');
                setInputParams('{\n  \n}');
                setError(null);
                setSuccess(null);
                setValidationError(null);
              }}
            >
              Clear
            </Button>
          </Box>
        </Paper>

        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Example
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Job Type: <code>example_task</code>
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Input Parameters:
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
{`{
  "input": "test data",
  "count": 10
}`}
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}
