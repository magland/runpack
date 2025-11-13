import { Button } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

interface RefreshButtonProps {
  onRefresh: () => void;
  loading?: boolean;
}

export function RefreshButton({ onRefresh, loading = false }: RefreshButtonProps) {
  return (
    <Button
      variant="outlined"
      startIcon={<RefreshIcon />}
      onClick={onRefresh}
      disabled={loading}
    >
      Refresh
    </Button>
  );
}
