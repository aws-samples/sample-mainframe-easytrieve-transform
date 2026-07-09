// Setup script: Updates ~/.kiro/settings/mcp.json with correct absolute path
const fs = require('fs');
const os = require('os');
const path = require('path');

const settingsPath = path.join(os.homedir(), '.kiro', 'settings', 'mcp.json');
const serverPath = path.join(os.homedir(), '.ezt-transform', 'mcp-server', 'dist', 'index.js').replace(/\\/g, '/');

// Verify server exists
if (!fs.existsSync(serverPath.replace(/\//g, path.sep))) {
  console.error('ERROR: MCP server not found at', serverPath);
  console.error('Run: git clone https://github.com/aws-samples/sample-mainframe-easytrieve-transform ' + path.join(os.homedir(), '.ezt-transform'));
  process.exit(1);
}

// Read current settings
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

// Update the EZT MCP server entry
if (!settings.powers) settings.powers = {};
if (!settings.powers.mcpServers) settings.powers.mcpServers = {};

settings.powers.mcpServers['power-sample-mainframe-easytrieve-transform-ezt-transform-mcp'] = {
  command: "node",
  args: [serverPath],
  env: { AWS_REGION: "us-east-1" },
  disabled: false,
  autoApprove: ["ezt_check_prereqs", "ezt_check_status", "ezt_get_results"]
};

fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 4));
console.log('✅ MCP server configured at:', serverPath);
console.log('   Restart Kiro or reconnect from MCP Servers panel.');
