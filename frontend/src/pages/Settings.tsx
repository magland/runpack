import { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Container,
  Alert,
} from '@mui/material';
import { useApiKeys } from '../hooks/useApiKeys';

export function Settings() {
  const { apiKeys, updateApiKeys, clearApiKeys } = useApiKeys();
  const [adminKey, setAdminKey] = useState(apiKeys.adminApiKey);
  const [submitKey, setSubmitKey] = useState(apiKeys.submitApiKey);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    updateApiKeys({
      adminApiKey: adminKey,
      submitApiKey: submitKey,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleClear = () => {
    setAdminKey('');
    setSubmitKey('');
    clearApiKeys();
    setSaved(false);
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Settings
        </Typography>
        
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            API Keys
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Configure your API keys to access the Runpack worker. API keys are stored in your browser's local storage.
          </Typography>

          {saved && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Settings saved successfully!
            </Alert>
          )}

          <TextField
            fullWidth
            label="Admin API Key"
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            sx={{ mb: 2 }}
            helperText="Required for accessing admin endpoints (jobs, runners, stats)"
          />

          <TextField
            fullWidth
            label="Submit API Key"
            type="password"
            value={submitKey}
            onChange={(e) => setSubmitKey(e.target.value)}
            sx={{ mb: 3 }}
            helperText="Required for submitting jobs in the playground"
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={!adminKey.trim() && !submitKey.trim()}
            >
              Save Keys
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={handleClear}
            >
              Clear All Keys
            </Button>
          </Box>
        </Paper>

        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            About
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Runpack Admin Dashboard v1.0.0
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Worker URL: https://runpack-worker.neurosift.app
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
}
