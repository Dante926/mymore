import { homedir } from 'os';
import { join } from 'path';

export default {
  mcp: {
    serverInfo: {
      name: 'mymore-mcp',
      version: '1.0.0',
    },
    transportType: 'stdio' as const,
  },
};
